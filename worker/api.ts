import { achievementStatements, GROUP_TITLES_SQL, EQUIP_TITLE_SQL } from './achievements'
import { handOverSql, OWNER_TO_ACTOR_SQL, removeMemberSql, SET_ROLE_SQL } from './membership'
import { TITLES, type EarnedTitle } from '../shared/achievements'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
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
import { firstName } from '../shared/format'
import { formatAmount } from '../shared/units'
import { normalizeReaction } from '../shared/social'
import { type AppEnv, currentUser } from './auth'
import { notifyUsers, type PushPayload } from './notifications'
import { DETACH_PHOTO_SQL, INSERT_PHOTO_SQL, MEMBER_PHOTO_SQL, PHOTO_MAX_BYTES, PHOTO_PATH, PHOTO_TYPE } from './photos'
import { profile } from './profile'
import {
  ALL_DAYS_MASK,
  badRequest,
  parseComment,
  parseEndpoint,
  parseEntry,
  parseGoal,
  parseName,
  parseNewGroup,
  parseRole,
  parseSettingsChange,
  parseSubscription,
} from './validate'

type Role = 'member' | 'admin'
type GroupRow = { id: string; name: string; owner_id: string; role: Role; timezone: string; invite_code: string; achievements_enabled: number }
type GoalRow = { id: string; group_id: string; name: string; start_date: string; end_date: string; archived_at: number | null }
type GoalAccessRow = GoalRow & { role: Role; timezone: string }

const INVITE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const INVITE_LENGTH = 10

const MEMBER_GROUP_SQL = `SELECT g.id, g.name, g.owner_id, m.role, g.timezone, g.invite_code,
  EXISTS (SELECT 1 FROM achievement_groups WHERE group_id = g.id) AS achievements_enabled FROM groups g
  JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
  WHERE g.id = ?`

const MEMBER_GOAL_SQL = `SELECT go.*, m.role, g.timezone FROM goals go
  JOIN groups g ON g.id = go.group_id
  JOIN memberships m ON m.group_id = go.group_id AND m.user_id = ?
  WHERE go.id = ?`

function notFound(): never {
  throw new HTTPException(404, { message: 'Not found' })
}

function forbidden(): never {
  throw new HTTPException(403, { message: 'Only a group admin can do this' })
}

const userId = (c: Context<AppEnv>) => currentUser(c).id


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

async function adminGroup(db: D1Database, groupId: string, uid: string): Promise<GroupRow> {
  const group = await memberGroup(db, groupId, uid)
  if (group.role !== 'admin') forbidden()
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
  if (goal.role !== 'admin') forbidden()
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
      `SELECT go.*, m.role, g.timezone, e.id AS entry_id, e.user_id AS entry_user_id FROM entries e
       JOIN goals go ON go.id = e.goal_id
       JOIN groups g ON g.id = go.group_id
       JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
       WHERE e.id = ?`,
    )
    .bind(uid, entryId)
    .first<GoalAccessRow & { entry_id: string; entry_user_id: string }>()
  if (!row) notFound()
  if (row.entry_user_id !== uid && row.role !== 'admin') forbidden()
  assertGoalOpen(row)
  return row
}

function insertComponent(db: D1Database, goalId: string, comp: ComponentInput, position: number) {
  return db
    .prepare('INSERT INTO components (id, goal_id, name, unit, target, weight, period, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), goalId, comp.name, comp.unit, comp.target, comp.weight, comp.period ?? 'day', position)
}

export const api = new Hono<AppEnv>()

api.get('/me', (c) => c.json({ user: c.get('user') }))

api.use(async (c, next) => {
  if (!c.get('user')) throw new HTTPException(401, { message: 'Sign in to continue' })
  if (c.req.method !== 'GET' && !(await c.env.WRITE_RATE_LIMITER.limit({ key: userId(c) })).success) {
    throw new HTTPException(429, { message: 'You are going too fast. Wait a minute and try again.' })
  }
  await next()
})

api.route('/me', profile)

api.get('/groups', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, m.role = 'admin' AS isAdmin,
       (SELECT COUNT(*) FROM memberships WHERE group_id = g.id) AS memberCount
     FROM groups g JOIN memberships m ON m.group_id = g.id AND m.user_id = ?1
     ORDER BY m.joined_at`,
  )
    .bind(userId(c))
    .all<Omit<GroupSummary, 'isAdmin'> & { isAdmin: number }>()
  return c.json(results.map<GroupSummary>((r) => ({ ...r, isAdmin: r.isAdmin === 1 })))
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
    c.env.DB.prepare("INSERT INTO memberships (group_id, user_id, joined_at, role) VALUES (?, ?, ?, 'admin')").bind(id, userId(c), now),
  ])
  return c.json({ id }, 201)
})

api.get('/groups/:groupId', async (c) => {
  const groupId = c.req.param('groupId')
  const db = c.env.DB
  const [access, members, goals, titles] = await db.batch([
    db.prepare(MEMBER_GROUP_SQL).bind(userId(c), groupId),
    db
      .prepare(
        `SELECT u.id, u.name, u.avatar_url AS avatarUrl, m.joined_at AS joinedAt, m.role = 'admin' AS isAdmin,
          COALESCE((SELECT title_id FROM group_title_preferences WHERE user_id = u.id AND group_id = m.group_id),
            (SELECT title_id FROM group_earned_titles WHERE user_id = u.id AND group_id = m.group_id ORDER BY CASE title_id
              WHEN 'legend' THEN 28 WHEN 'veteran' THEN 14 WHEN 'disciple' THEN 7 WHEN 'acolyte' THEN 3 ELSE 1 END DESC LIMIT 1)) AS selectedTitle FROM users u JOIN memberships m ON m.user_id = u.id
         WHERE m.group_id = ? ORDER BY m.joined_at`,
      )
      .bind(groupId),
    db.prepare('SELECT * FROM goals WHERE group_id = ? ORDER BY created_at DESC').bind(groupId),
    db.prepare(GROUP_TITLES_SQL).bind(groupId),
  ])
  const group = (access.results[0] as GroupRow | undefined) ?? notFound()
  const isAdmin = group.role === 'admin'
  const detail: GroupDetail = {
    id: group.id,
    name: group.name,
    timezone: group.timezone,
    isAdmin,
    inviteCode: isAdmin ? group.invite_code : null,
    members: (members.results as (Omit<Member, 'isAdmin'> & { isAdmin: number })[]).map((m) => ({
      ...m,
      isAdmin: m.isAdmin === 1,
      selectedTitle: group.achievements_enabled === 1 ? m.selectedTitle : null,
    })),
    achievementsEnabled: group.achievements_enabled === 1,
    earnedTitles: group.achievements_enabled === 1 ? titles.results as EarnedTitle[] : [],
    goals: (goals.results as GoalRow[]).map(toGoalSummary),
  }
  return c.json(detail)
})

api.put('/groups/:groupId/title', async (c) => {
  const group = await memberGroup(c.env.DB, c.req.param('groupId'), userId(c))
  if (group.achievements_enabled !== 1) notFound()
  const body = await c.req.json<unknown>()
  if (!body || typeof body !== 'object' || !('titleId' in body)) badRequest('Choose a valid title')
  const titleId = body.titleId
  if (typeof titleId !== 'string' || !TITLES.some((t) => t.id === titleId)) badRequest('Choose a valid title')
  const result = await c.env.DB.prepare(EQUIP_TITLE_SQL).bind(group.id, userId(c), titleId).run()
  if (!result.meta.changes) badRequest('You have not earned that title yet')
  return c.body(null, 204)
})

api.patch('/groups/:groupId', async (c) => {
  const group = await adminGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const name = parseName(await c.req.json())
  await c.env.DB.prepare('UPDATE groups SET name = ? WHERE id = ?').bind(name, group.id).run()
  return c.body(null, 204)
})

api.post('/groups/:groupId/invite-code', async (c) => {
  const group = await adminGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const inviteCode = newInviteCode()
  await c.env.DB.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').bind(inviteCode, group.id).run()
  return c.json({ inviteCode })
})

api.delete('/groups/:groupId/members/:userId', async (c) => {
  const group = await adminGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const memberId = c.req.param('userId')
  if (memberId === userId(c)) badRequest('Leave the group from the members list instead')
  await c.env.DB.batch(
    [OWNER_TO_ACTOR_SQL, ...removeMemberSql('admin')].map((sql) => c.env.DB.prepare(sql).bind(memberId, group.id, userId(c))),
  )
  return c.body(null, 204)
})

api.put('/groups/:groupId/members/:userId/role', async (c) => {
  const group = await adminGroup(c.env.DB, c.req.param('groupId'), userId(c))
  const memberId = c.req.param('userId')
  if (memberId === userId(c)) badRequest('You cannot change your own role')
  const role = parseRole(await c.req.json())
  const [updated] = await c.env.DB.batch([
    c.env.DB.prepare(SET_ROLE_SQL).bind(memberId, group.id, userId(c), role),
    c.env.DB.prepare(OWNER_TO_ACTOR_SQL).bind(memberId, group.id, userId(c)),
  ])
  if (!updated.meta.changes) notFound()
  return c.body(null, 204)
})

api.delete('/groups/:groupId/membership', async (c) => {
  const group = await memberGroup(c.env.DB, c.req.param('groupId'), userId(c))
  await c.env.DB.batch(
    [...handOverSql('group'), ...removeMemberSql('self')].map((sql) => c.env.DB.prepare(sql).bind(userId(c), group.id)),
  )
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
  const group = await adminGroup(c.env.DB, c.req.param('groupId'), userId(c))
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
  const refresh = achievementStatements(db, goalId)
  const [access, components, entries, reactions, comments] = (await db.batch([
    ...refresh,
    db.prepare(MEMBER_GOAL_SQL).bind(uid, goalId),
    db.prepare('SELECT id, name, unit, target, weight, period FROM components WHERE goal_id = ? ORDER BY position').bind(goalId),
    db
      .prepare(
        `SELECT e.id, e.component_id AS componentId, e.user_id AS userId, e.amount, e.date, e.note, e.occurred_at AS occurredAt,
           e.created_at AS createdAt, '${PHOTO_PATH}' || p.key AS photoUrl
         FROM entries e LEFT JOIN photos p ON p.entry_id = e.id
         WHERE e.goal_id = ? ORDER BY e.created_at DESC`,
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
  ])).slice(refresh.length)
  const goal = (access.results[0] as GoalRow | undefined) ?? notFound()
  const commentsByEntry = new Map<string, Comment[]>()
  for (const { entryId, ...comment } of comments.results as (Comment & { entryId: string })[]) {
    const list = commentsByEntry.get(entryId) ?? []
    list.push(comment)
    commentsByEntry.set(entryId, list)
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
  const kept = await db
    .prepare(`SELECT COUNT(*) AS n FROM components WHERE goal_id = ? AND id NOT IN (${removedIds.map(() => '?').join(', ')})`)
    .bind(goal.id, ...removedIds)
    .first<{ n: number }>()
  if (kept?.n !== input.components.filter((comp) => comp.id).length) badRequest('This goal changed while you were editing. Reload and try again.')
  await db.batch([
    db.prepare('UPDATE goals SET name = ?, start_date = ?, end_date = ? WHERE id = ?').bind(input.name, input.startDate, input.endDate, goal.id),
    db
      .prepare(`DELETE FROM components WHERE goal_id = ? AND id IN (${removedIds.map(() => '?').join(', ')})`)
      .bind(goal.id, ...removedIds),
    ...input.components.map((comp, position) =>
      comp.id
        ? db
            .prepare('UPDATE components SET name = ?, unit = ?, target = ?, weight = ?, period = COALESCE(?, period), position = ? WHERE id = ? AND goal_id = ?')
            .bind(comp.name, comp.unit, comp.target, comp.weight, comp.period ?? null, position, comp.id, goal.id)
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
  await c.env.DB.batch([c.env.DB.prepare(
    `INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, occurred_at, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, goal.id, input.componentId, userId(c), input.amount, date, input.occurredAt, input.note, Date.now()),
    ...achievementStatements(c.env.DB, goal.id),
  ])
  inBackground(c, notifyContribution(c, goal, id, input))
  return c.json({ id }, 201)
})

api.put('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  const input = parseEntry(await c.req.json())
  const date = await loggableDate(c.env.DB, goal, input)
  await c.env.DB.batch([c.env.DB.prepare('UPDATE entries SET component_id = ?, amount = ?, date = ?, occurred_at = ?, note = ? WHERE id = ?')
    .bind(input.componentId, input.amount, date, input.occurredAt, input.note, goal.entry_id),
    ...achievementStatements(c.env.DB, goal.id),
  ])
  return c.body(null, 204)
})

api.delete('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(goal.entry_id),
    ...achievementStatements(c.env.DB, goal.id),
  ])
  return c.body(null, 204)
})

api.put(
  '/entries/:entryId/photo',
  bodyLimit({ maxSize: PHOTO_MAX_BYTES, onError: (c) => c.json({ error: 'That photo is too large' }, 413) }),
  async (c) => {
    const entry = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
    if (c.req.header('content-type') !== PHOTO_TYPE) throw new HTTPException(415, { message: 'Upload a JPEG image' })
    const image = await c.req.arrayBuffer()
    if (image.byteLength === 0) badRequest('Choose a photo')
    const key = crypto.randomUUID()
    await c.env.PHOTOS.put(key, image, { httpMetadata: { contentType: PHOTO_TYPE } })
    await c.env.DB.batch([
      c.env.DB.prepare(DETACH_PHOTO_SQL).bind(entry.entry_id),
      c.env.DB.prepare(INSERT_PHOTO_SQL).bind(key, entry.entry_id, Date.now()),
    ])
    return c.body(null, 204)
  },
)

api.delete('/entries/:entryId/photo', async (c) => {
  const entry = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.prepare(DETACH_PHOTO_SQL).bind(entry.entry_id).run()
  return c.body(null, 204)
})

api.get('/photos/:key', async (c) => {
  const key = c.req.param('key')
  if (!(await c.env.DB.prepare(MEMBER_PHOTO_SQL).bind(userId(c), key).first())) notFound()
  const photo = (await c.env.PHOTOS.get(key)) ?? notFound()
  return c.body(photo.body, 200, { 'content-type': PHOTO_TYPE, 'cache-control': 'private, max-age=31536000, immutable' })
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
      title: `${firstName(c.get('user')!.name)} logged ${formatAmount(input.amount, unit)} ${name.toLowerCase()}`,
      body: input.note ?? groupName,
      url: `/g/${goal.group_id}?entry=${entryId}`,
      tag: `contribution-${goal.group_id}-${userId(c)}`,
    },
  )
}

type SocialEntryRow = {
  id: string
  user_id: string
  owner_name: string
  amount: number
  group_id: string
  component_name: string
  unit: string
}

async function memberEntry(db: D1Database, entryId: string, uid: string): Promise<SocialEntryRow> {
  const row = await db
    .prepare(
      `SELECT e.id, e.user_id, u.name AS owner_name, e.amount, g.id AS group_id,
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
  const activity = `${formatAmount(entry.amount, entry.unit)} ${entry.component_name.toLowerCase()}`
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
    `SELECT cm.id, cm.user_id, m.role FROM comments cm
     JOIN entries e ON e.id = cm.entry_id
     JOIN goals go ON go.id = e.goal_id
     JOIN groups g ON g.id = go.group_id
     JOIN memberships m ON m.group_id = g.id AND m.user_id = ?
     WHERE cm.id = ?`,
  )
    .bind(userId(c), c.req.param('commentId'))
    .first<{ id: string; user_id: string; role: Role }>()
  if (!row) notFound()
  if (row.user_id !== userId(c) && row.role !== 'admin') forbidden()
  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(row.id).run()
  return c.body(null, 204)
})

const MAX_DEVICES_PER_USER = 5

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
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at`,
      )
      .bind(sub.endpoint, userId(c), sub.keys.p256dh, sub.keys.auth, Date.now()),
    db
      .prepare(
        `DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint NOT IN
           (SELECT endpoint FROM push_subscriptions WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2)`,
      )
      .bind(userId(c), MAX_DEVICES_PER_USER),
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
