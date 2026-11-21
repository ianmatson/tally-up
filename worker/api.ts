import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type {
  Comment,
  Component,
  ComponentInput,
  Entry,
  EntryInput,
  GoalDetail,
  GoalSummary,
  GroupDetail,
  GroupSummary,
  InvitePreview,
  Member,
  NotificationConfig,
  NotificationSettings,
} from '../shared/api'
import { todayIn } from '../shared/dates'
import { firstName, formatNumber } from '../shared/format'
import { normalizeReaction } from '../shared/social'
import type { AppEnv } from './auth'
import { notifyUsers, type PushPayload } from './notifications'
import {
  ALL_DAYS_MASK,
  badRequest,
  parseComment,
  parseEndpoint,
  parseEntry,
  parseGoal,
  parseName,
  parseNewGroup,
  parseSettingsChange,
  parseSubscription,
} from './validate'

type GroupRow = { id: string; name: string; owner_id: string; timezone: string; invite_code: string }
type GoalRow = { id: string; group_id: string; name: string; start_date: string; end_date: string; archived_at: number | null }
type GoalAccessRow = GoalRow & { owner_id: string; timezone: string }

const INVITE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const INVITE_LENGTH = 10

const MEMBER_GROUP_SQL = `SELECT g.id, g.name, g.owner_id, g.timezone, g.invite_code FROM groups g
  JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
  WHERE g.id = ?`

const MEMBER_GOAL_SQL = `SELECT go.*, g.owner_id, g.timezone FROM goals go
  JOIN groups g ON g.id = go.group_id
  JOIN memberships m ON m.group_id = go.group_id AND m.user_id = ?
  WHERE go.id = ?`

function notFound(): never {
  throw new HTTPException(404, { message: 'Not found' })
}

function forbidden(): never {
  throw new HTTPException(403, { message: 'Only the group admin can do this' })
}

const userId = (c: Context<AppEnv>) => c.get('user')!.id


function inBackground(c: Context<AppEnv>, work: Promise<unknown>) {
  c.executionCtx.waitUntil(work.catch((error) => console.error('Notification failed', error)))
}

function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_LENGTH))
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('')
}

function toGoalSummary(row: GoalRow): GoalSummary {
  return { id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date, archived: row.archived_at !== null }
}

async function memberGroup(db: D1Database, groupId: string, uid: string): Promise<GroupRow> {
  return (await db.prepare(MEMBER_GROUP_SQL).bind(uid, groupId).first<GroupRow>()) ?? notFound()
}

async function ownedGroup(db: D1Database, groupId: string, uid: string): Promise<GroupRow> {
  const group = await memberGroup(db, groupId, uid)
  if (group.owner_id !== uid) forbidden()
  return group
}

async function memberGoal(db: D1Database, goalId: string, uid: string): Promise<GoalAccessRow> {
  return (await db.prepare(MEMBER_GOAL_SQL).bind(uid, goalId).first<GoalAccessRow>()) ?? notFound()
}

function assertGoalOpen(goal: GoalRow) {
  if (goal.archived_at !== null) badRequest('This goal has ended and can no longer be changed')
}

async function openOwnedGoal(db: D1Database, goalId: string, uid: string): Promise<GoalAccessRow> {
  const goal = await memberGoal(db, goalId, uid)
  if (goal.owner_id !== uid) forbidden()
  assertGoalOpen(goal)
  return goal
}

const CLOCK_SKEW_MS = 5 * 60_000

async function loggableDate(db: D1Database, goal: GoalAccessRow, input: EntryInput): Promise<string> {
  if (input.occurredAt > Date.now() + CLOCK_SKEW_MS) badRequest('You cannot log progress in the future')
  const date = todayIn(goal.timezone, new Date(input.occurredAt))
  if (date < goal.start_date || date > goal.end_date) badRequest('The date must be inside the goal period')
  const component = await db.prepare('SELECT 1 FROM components WHERE id = ? AND goal_id = ?').bind(input.componentId, goal.id).first()
  if (!component) badRequest('That activity is not part of this goal')
  return date
}

async function editableEntry(db: D1Database, entryId: string, uid: string): Promise<GoalAccessRow & { entry_id: string }> {
  const row = await db
    .prepare(
      `SELECT go.*, g.owner_id, g.timezone, e.id AS entry_id, e.user_id AS entry_user_id FROM entries e
       JOIN goals go ON go.id = e.goal_id
       JOIN groups g ON g.id = go.group_id
       JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
       WHERE e.id = ?`,
    )
    .bind(uid, entryId)
    .first<GoalAccessRow & { entry_id: string; entry_user_id: string }>()
  if (!row) notFound()
  if (row.entry_user_id !== uid && row.owner_id !== uid) forbidden()
  assertGoalOpen(row)
  return row
}

function insertComponent(db: D1Database, goalId: string, comp: ComponentInput, position: number) {
  return db
    .prepare('INSERT INTO components (id, goal_id, name, unit, target, weight, position) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), goalId, comp.name, comp.unit, comp.target, comp.weight, position)
}

export const api = new Hono<AppEnv>()

api.get('/me', (c) => c.json({ user: c.get('user') }))

api.use(async (c, next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Sign in to continue' })
  await next()
})

api.get('/groups', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.owner_id = ?1 AS isOwner,
       (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) AS memberCount
     FROM groups g JOIN memberships m ON m.group_id = g.id AND m.user_id = ?1
     ORDER BY m.joined_at`,
  )
    .bind(userId(c))
    .all<Omit<GroupSummary, 'isOwner'> & { isOwner: number }>()
  return c.json(results.map<GroupSummary>((r) => ({ ...r, isOwner: r.isOwner === 1 })))
})

api.post('/groups', async (c) => {
  const { name, timezone } = parseNewGroup(await c.req.json())
  const id = crypto.randomUUID()
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO groups (id, name, owner_id, timezone, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      id,
      name,
      userId(c),
      timezone,
      newInviteCode(),
      now,
    ),
    c.env.DB.prepare('INSERT INTO memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(id, userId(c), now),
  ])
  return c.json({ id }, 201)
})

api.get('/groups/:groupId', async (c) => {
  const groupId = c.req.param('groupId')
  const db = c.env.DB
  const [access, members, goals] = await db.batch([
    db.prepare(MEMBER_GROUP_SQL).bind(userId(c), groupId),
    db
      .prepare(
        `SELECT u.id, u.name, u.avatar_url AS avatarUrl, m.joined_at AS joinedAt FROM users u JOIN memberships m ON m.user_id = u.id
         WHERE m.group_id = ? ORDER BY m.joined_at`,
      )
      .bind(groupId),
    db.prepare('SELECT * FROM goals WHERE group_id = ? ORDER BY created_at DESC').bind(groupId),
  ])
  const group = (access.results[0] as GroupRow | undefined) ?? notFound()
  const isOwner = group.owner_id === userId(c)
  const detail: GroupDetail = {
    id: group.id,
    name: group.name,
    timezone: group.timezone,
    ownerId: group.owner_id,
    isOwner,
    inviteCode: isOwner ? group.invite_code : null,
    members: members.results as Member[],
    goals: (goals.results as GoalRow[]).map(toGoalSummary),
  }
  return c.json(detail)
})

api.patch('/groups/:groupId', async (c) => {
  const group = await ownedGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const name = parseName(await c.req.json())
  await c.env.DB.prepare('UPDATE groups SET name = ? WHERE id = ?').bind(name, group.id).run()
  return c.body(null, 204)
})

api.post('/groups/:groupId/invite-code', async (c) => {
  const group = await ownedGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const inviteCode = newInviteCode()
  await c.env.DB.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').bind(inviteCode, group.id).run()
  return c.json({ inviteCode })
})

api.delete('/groups/:groupId/members/:userId', async (c) => {
  const group = await ownedGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const memberId = c.req.param('userId')
  if (memberId === group.owner_id) badRequest('The admin cannot be removed')
  const groupEntries = 'SELECT e.id FROM entries e JOIN goals go ON go.id = e.goal_id WHERE go.group_id = ?'
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM comments WHERE user_id = ? AND entry_id IN (${groupEntries})`).bind(memberId, group.id),
    c.env.DB.prepare(`DELETE FROM reactions WHERE user_id = ? AND entry_id IN (${groupEntries})`).bind(memberId, group.id),
    c.env.DB.prepare('DELETE FROM entries WHERE user_id = ? AND goal_id IN (SELECT id FROM goals WHERE group_id = ?)').bind(
      memberId,
      group.id,
    ),
    c.env.DB.prepare('DELETE FROM memberships WHERE group_id = ? AND user_id = ?').bind(group.id, memberId),
  ])
  return c.body(null, 204)
})

api.get('/invites/:code', async (c) => {
  const preview = await c.env.DB.prepare(
    `SELECT g.id AS groupId, g.name AS groupName,
       (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) AS memberCount,
       EXISTS (SELECT 1 FROM memberships WHERE group_id = g.id AND user_id = ?) AS alreadyMember
     FROM groups g WHERE g.invite_code = ?`,
  )
    .bind(userId(c), c.req.param('code'))
    .first<Omit<InvitePreview, 'alreadyMember'> & { alreadyMember: number }>()
  if (!preview) notFound()
  return c.json<InvitePreview>({ ...preview, alreadyMember: preview.alreadyMember === 1 })
})

api.post('/invites/:code', async (c) => {
  const group = await c.env.DB.prepare('SELECT id FROM groups WHERE invite_code = ?').bind(c.req.param('code')).first<{ id: string }>()
  if (!group) notFound()
  await c.env.DB.prepare('INSERT OR IGNORE INTO memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)')
    .bind(group.id, userId(c), Date.now())
    .run()
  return c.json({ groupId: group.id })
})

api.post('/groups/:groupId/goals', async (c) => {
  const group = await ownedGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const input = parseGoal(await c.req.json())
  const goalId = crypto.randomUUID()
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE goals SET archived_at = ? WHERE group_id = ? AND archived_at IS NULL').bind(now, group.id),
    c.env.DB.prepare('INSERT INTO goals (id, group_id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      goalId,
      group.id,
      input.name,
      input.startDate,
      input.endDate,
      now,
    ),
    ...input.components.map((comp, position) => insertComponent(c.env.DB, goalId, comp, position)),
  ])
  return c.json({ id: goalId }, 201)
})

type EntryRow = Omit<Entry, 'reactions' | 'comments'>

async function loadGoalDetail(db: D1Database, goalId: string, uid: string): Promise<GoalDetail> {
  const [access, components, entries, reactions, comments] = await db.batch([
    db.prepare(MEMBER_GOAL_SQL).bind(uid, goalId),
    db.prepare('SELECT id, name, unit, target, weight FROM components WHERE goal_id = ? ORDER BY position').bind(goalId),
    db
      .prepare(
        `SELECT id, component_id AS componentId, user_id AS userId, amount, date, note, occurred_at AS occurredAt, created_at AS createdAt FROM entries
         WHERE goal_id = ? ORDER BY created_at DESC`,
      )
      .bind(goalId),
    db
      .prepare(
        `SELECT r.entry_id AS entryId, r.emoji, r.user_id AS userId FROM reactions r JOIN entries e ON e.id = r.entry_id
         WHERE e.goal_id = ? ORDER BY r.created_at`,
      )
      .bind(goalId),
    db
      .prepare(
        `SELECT c.id, c.entry_id AS entryId, c.user_id AS userId, c.body, c.created_at AS createdAt FROM comments c
         JOIN entries e ON e.id = c.entry_id WHERE e.goal_id = ? ORDER BY c.created_at`,
      )
      .bind(goalId),
  ])
  const goal = (access.results[0] as GoalRow | undefined) ?? notFound()
  const commentsByEntry = new Map<string, Comment[]>()
  for (const { entryId, ...comment } of comments.results as (Comment & { entryId: string })[]) {
    commentsByEntry.set(entryId, [...(commentsByEntry.get(entryId) ?? []), comment])
  }
  const reactionsByEntry = new Map<string, Map<string, string[]>>()
  for (const r of reactions.results as { entryId: string; emoji: string; userId: string }[]) {
    const byEmoji = reactionsByEntry.get(r.entryId) ?? new Map<string, string[]>()
    byEmoji.set(r.emoji, [...(byEmoji.get(r.emoji) ?? []), r.userId])
    reactionsByEntry.set(r.entryId, byEmoji)
  }
  return {
    ...toGoalSummary(goal),
    components: components.results as Component[],
    entries: (entries.results as EntryRow[]).map((entry) => ({
      ...entry,
      reactions: [...(reactionsByEntry.get(entry.id) ?? new Map()).entries()].map(([emoji, userIds]) => ({ emoji, userIds })),
      comments: commentsByEntry.get(entry.id) ?? [],
    })),
  }
}

api.get('/goals/:goalId', async (c) => c.json(await loadGoalDetail(c.env.DB, c.req.param('goalId'), userId(c))))

api.put('/goals/:goalId', async (c) => {
  const goal = await openOwnedGoal(c.env.DB, c.req.param('goalId'), userId(c))
  const input = parseGoal(await c.req.json())
  const removedIds = input.removedComponentIds
  const db = c.env.DB
  await db.batch([
    db.prepare('UPDATE goals SET name = ?, start_date = ?, end_date = ? WHERE id = ?').bind(input.name, input.startDate, input.endDate, goal.id),
    db
      .prepare(`DELETE FROM components WHERE goal_id = ? AND id IN (${removedIds.map(() => '?').join(', ')})`)
      .bind(goal.id, ...removedIds),
    ...input.components.map((comp, position) =>
      comp.id
        ? db
            .prepare('UPDATE components SET name = ?, unit = ?, target = ?, weight = ?, position = ? WHERE id = ? AND goal_id = ?')
            .bind(comp.name, comp.unit, comp.target, comp.weight, position, comp.id, goal.id)
        : insertComponent(db, goal.id, comp, position),
    ),
  ])
  return c.json(await loadGoalDetail(db, goal.id, userId(c)))
})

api.post('/goals/:goalId/entries', async (c) => {
  const goal = await memberGoal(c.env.DB, c.req.param('goalId'), userId(c))
  assertGoalOpen(goal)
  const input = parseEntry(await c.req.json())
  const date = await loggableDate(c.env.DB, goal, input)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, occurred_at, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, goal.id, input.componentId, userId(c), input.amount, date, input.occurredAt, input.note, Date.now())
    .run()
  inBackground(c, notifyContribution(c, goal, id, input))
  return c.json({ id }, 201)
})

api.put('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  const input = parseEntry(await c.req.json())
  const date = await loggableDate(c.env.DB, goal, input)
  await c.env.DB.prepare('UPDATE entries SET component_id = ?, amount = ?, date = ?, occurred_at = ?, note = ? WHERE id = ?')
    .bind(input.componentId, input.amount, date, input.occurredAt, input.note, goal.entry_id)
    .run()
  return c.body(null, 204)
})

api.delete('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(goal.entry_id).run()
  return c.body(null, 204)
})

async function notifyContribution(c: Context<AppEnv>, goal: GoalAccessRow, entryId: string, input: EntryInput) {
  const db = c.env.DB
  const [component, group, members] = await db.batch([
    db.prepare('SELECT name, unit FROM components WHERE id = ?').bind(input.componentId),
    db.prepare('SELECT name FROM groups WHERE id = ?').bind(goal.group_id),
    db.prepare('SELECT user_id FROM memberships WHERE group_id = ? AND user_id != ?').bind(goal.group_id, userId(c)),
  ])
  const { name, unit } = component.results[0] as { name: string; unit: string }
  const groupName = (group.results[0] as { name: string }).name
  await notifyUsers(
    c.env,
    'contributions',
    (members.results as { user_id: string }[]).map((m) => m.user_id),
    {
      title: `${firstName(c.get('user')!.name)} logged ${formatNumber(input.amount)} ${unit} ${name.toLowerCase()}`,
      body: input.note ?? groupName,
      url: `/g/${goal.group_id}?entry=${entryId}`,
      tag: `entry-${entryId}`,
    },
  )
}

type SocialEntryRow = {
  id: string
  user_id: string
  owner_name: string
  amount: number
  group_id: string
  group_owner_id: string
  component_name: string
  unit: string
}

async function memberEntry(db: D1Database, entryId: string, uid: string): Promise<SocialEntryRow> {
  const row = await db
    .prepare(
      `SELECT e.id, e.user_id, u.name AS owner_name, e.amount, g.id AS group_id, g.owner_id AS group_owner_id,
         c.name AS component_name, c.unit
       FROM entries e
       JOIN users u ON u.id = e.user_id
       JOIN components c ON c.id = e.component_id
       JOIN goals go ON go.id = e.goal_id
       JOIN groups g ON g.id = go.group_id
       JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
       WHERE e.id = ?`,
    )
    .bind(uid, entryId)
    .first<SocialEntryRow>()
  return row ?? notFound()
}

api.post('/entries/:entryId/comments', async (c) => {
  const entry = await memberEntry(c.env.DB, c.req.param('entryId'), userId(c))
  const body = parseComment(await c.req.json())
  const comment: Comment = { id: crypto.randomUUID(), userId: userId(c), body, createdAt: Date.now() }
  await c.env.DB.prepare('INSERT INTO comments (id, entry_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(comment.id, entry.id, comment.userId, comment.body, comment.createdAt)
    .run()
  inBackground(c, notifyComment(c, entry, body))
  return c.json(comment, 201)
})

async function notifyComment(c: Context<AppEnv>, entry: SocialEntryRow, body: string) {
  const actor = c.get('user')!
  const { results } = await c.env.DB.prepare('SELECT DISTINCT user_id FROM comments WHERE entry_id = ? AND user_id NOT IN (?, ?)')
    .bind(entry.id, actor.id, entry.user_id)
    .all<{ user_id: string }>()
  const activity = `${formatNumber(entry.amount)} ${entry.unit} ${entry.component_name.toLowerCase()}`
  const payload = (title: string): PushPayload => ({
    title,
    body,
    url: `/g/${entry.group_id}?entry=${entry.id}`,
    tag: `comments-${entry.id}`,
  })
  await Promise.all([
    entry.user_id === actor.id
      ? null
      : notifyUsers(c.env, 'comments', [entry.user_id], payload(`${firstName(actor.name)} commented on your ${activity}`)),
    notifyUsers(
      c.env,
      'comments',
      results.map((r) => r.user_id),
      payload(`${firstName(actor.name)} commented on ${entry.user_id === actor.id ? 'their' : `${firstName(entry.owner_name)}'s`} ${activity}`),
    ),
  ])
}

api.delete('/comments/:commentId', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT cm.id, cm.user_id, g.owner_id FROM comments cm
     JOIN entries e ON e.id = cm.entry_id
     JOIN goals go ON go.id = e.goal_id
     JOIN groups g ON g.id = go.group_id
     JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
     WHERE cm.id = ?`,
  )
    .bind(userId(c), c.req.param('commentId'))
    .first<{ id: string; user_id: string; owner_id: string }>()
  if (!row) notFound()
  if (row.user_id !== userId(c) && row.owner_id !== userId(c)) forbidden()
  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(row.id).run()
  return c.body(null, 204)
})

const SINGLE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v')

function reactionEmoji(c: Context<AppEnv>): string {
  const emoji = normalizeReaction(c.req.param('emoji') ?? '')
  if (!SINGLE_EMOJI.test(emoji)) badRequest('Reactions must be a single emoji')
  return emoji
}

api.put('/entries/:entryId/reactions/:emoji', async (c) => {
  const entry = await memberEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.prepare('INSERT OR IGNORE INTO reactions (entry_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)')
    .bind(entry.id, userId(c), reactionEmoji(c), Date.now())
    .run()
  return c.body(null, 204)
})

api.delete('/entries/:entryId/reactions/:emoji', async (c) => {
  const entry = await memberEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.prepare('DELETE FROM reactions WHERE entry_id = ? AND user_id = ? AND emoji = ?')
    .bind(entry.id, userId(c), reactionEmoji(c))
    .run()
  return c.body(null, 204)
})

const DEFAULT_SETTINGS: Omit<NotificationSettings, 'timezone'> = {
  reminders: true,
  reminderMinute: 19 * 60,
  reminderDays: ALL_DAYS_MASK,
  contributions: true,
  comments: true,
}

type SettingsRow = { reminders: number; reminder_minute: number; reminder_days: number; contributions: number; comments: number; timezone: string }

api.get('/notifications', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT reminders, reminder_minute, reminder_days, contributions, comments, timezone FROM notification_settings WHERE user_id = ?',
  )
    .bind(userId(c))
    .first<SettingsRow>()
  const settings: NotificationSettings = row
    ? {
        reminders: row.reminders === 1,
        reminderMinute: row.reminder_minute,
        reminderDays: row.reminder_days,
        contributions: row.contributions === 1,
        comments: row.comments === 1,
        timezone: row.timezone,
      }
    : { ...DEFAULT_SETTINGS, timezone: 'UTC' }
  return c.json<NotificationConfig>({ settings, vapidPublicKey: c.env.VAPID_PUBLIC_KEY })
})

api.patch('/notifications', async (c) => {
  const { timezone, columns } = parseSettingsChange(await c.req.json())
  if (columns.length === 0) badRequest('Nothing to change')
  const db = c.env.DB
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO notification_settings (user_id, timezone) VALUES (?, ?)').bind(userId(c), timezone),
    db
      .prepare(`UPDATE notification_settings SET ${columns.map(([column]) => `${column} = ?`).join(', ')} WHERE user_id = ?`)
      .bind(...columns.map(([, value]) => value), userId(c)),
  ])
  return c.body(null, 204)
})

api.post('/push-subscriptions', async (c) => {
  const sub = parseSubscription(await c.req.json())
  const db = c.env.DB
  await db.batch([
    db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      )
      .bind(sub.endpoint, userId(c), sub.keys.p256dh, sub.keys.auth, Date.now()),
    db
      .prepare(
        'INSERT OR IGNORE INTO notification_settings (user_id, timezone) VALUES (?, ?)',
      )
      .bind(userId(c), sub.timezone),
  ])
  return c.body(null, 204)
})

api.delete('/push-subscriptions', async (c) => {
  const endpoint = parseEndpoint(await c.req.json())
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, userId(c)).run()
  return c.body(null, 204)
})

api.post('/notifications/test', async (c) => {
  const delivered = await notifyUsers(c.env, null, [userId(c)], {
    title: 'Notifications are on',
    body: 'This is how Tally Up will reach you.',
    url: '/settings',
    tag: 'test',
  })
  if (delivered === 0) badRequest('No device accepted the test. Turn notifications off and on again on this device.')
  return c.body(null, 204)
})
