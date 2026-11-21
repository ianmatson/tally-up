import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Component, ComponentInput, Entry, EntryInput, GoalDetail, GoalSummary, GroupDetail, GroupSummary, InvitePreview, Member } from '../shared/api'
import { todayIn } from '../shared/dates'
import type { AppEnv } from './auth'
import { badRequest, parseEntry, parseGoal, parseName, parseNewGroup } from './validate'

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

async function assertLoggable(db: D1Database, goal: GoalAccessRow, input: EntryInput) {
  if (input.date < goal.start_date || input.date > goal.end_date) badRequest('The date must be inside the goal period')
  if (input.date > todayIn(goal.timezone)) badRequest('You cannot log progress for a future date')
  const component = await db.prepare('SELECT 1 FROM components WHERE id = ? AND goal_id = ?').bind(input.componentId, goal.id).first()
  if (!component) badRequest('That activity is not part of this goal')
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
        `SELECT u.id, u.name, u.avatar_url AS avatarUrl FROM users u JOIN memberships m ON m.user_id = u.id
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
  await c.env.DB.batch([
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

async function loadGoalDetail(db: D1Database, goalId: string, uid: string): Promise<GoalDetail> {
  const [access, components, entries] = await db.batch([
    db.prepare(MEMBER_GOAL_SQL).bind(uid, goalId),
    db.prepare('SELECT id, name, unit, target, weight FROM components WHERE goal_id = ? ORDER BY position').bind(goalId),
    db
      .prepare(
        `SELECT id, component_id AS componentId, user_id AS userId, amount, date, note FROM entries
         WHERE goal_id = ? ORDER BY date DESC, created_at DESC`,
      )
      .bind(goalId),
  ])
  const goal = (access.results[0] as GoalRow | undefined) ?? notFound()
  return { ...toGoalSummary(goal), components: components.results as Component[], entries: entries.results as Entry[] }
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
  await assertLoggable(c.env.DB, goal, input)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, goal.id, input.componentId, userId(c), input.amount, input.date, input.note, Date.now())
    .run()
  return c.json({ id }, 201)
})

api.put('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  const input = parseEntry(await c.req.json())
  await assertLoggable(c.env.DB, goal, input)
  await c.env.DB.prepare('UPDATE entries SET component_id = ?, amount = ?, date = ?, note = ? WHERE id = ?')
    .bind(input.componentId, input.amount, input.date, input.note, goal.entry_id)
    .run()
  return c.body(null, 204)
})

api.delete('/entries/:entryId', async (c) => {
  const goal = await editableEntry(c.env.DB, c.req.param('entryId'), userId(c))
  await c.env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(goal.entry_id).run()
  return c.body(null, 204)
})
