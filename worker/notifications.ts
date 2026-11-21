import { buildPushHTTPRequest } from '@pushforge/builder'
import { todayIn, wallClockMs } from '../shared/dates'

export type PushPayload = { title: string; body: string; url: string; tag: string }

export type NotificationKind = 'contributions' | 'comments'

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string }

const ADMIN_CONTACT = 'mailto:howdy@ian-matson.com'
const DAY_SECONDS = 86_400
const REMINDER_WINDOW_MINUTES = 60
const GONE_STATUSES = new Set([404, 410])

async function sendToSubscriptions(env: Env, subscriptions: SubscriptionRow[], payload: PushPayload, ttl = DAY_SECONDS): Promise<number> {
  const accepted = await Promise.all(
    subscriptions.map(async (sub) => {
      const request = await buildPushHTTPRequest({
        privateJWK: env.VAPID_PRIVATE_KEY,
        subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message: { payload, adminContact: ADMIN_CONTACT, options: { ttl, urgency: 'normal' } },
      })
      const response = await fetch(request.endpoint, { method: 'POST', headers: request.headers, body: request.body, redirect: 'manual' })
      if (GONE_STATUSES.has(response.status)) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
      } else if (!response.ok) {
        console.error('Push failed', response.status, await response.text())
      }
      return response.ok
    }),
  )
  return accepted.filter(Boolean).length
}

export async function notifyUsers(env: Env, kind: NotificationKind | null, userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0
  const placeholders = userIds.map(() => '?').join(', ')
  const optIn = kind ? `AND EXISTS (SELECT 1 FROM notification_settings s WHERE s.user_id = p.user_id AND s.${kind} = 1)` : ''
  const { results } = await env.DB.prepare(
    `SELECT p.endpoint, p.p256dh, p.auth FROM push_subscriptions p WHERE p.user_id IN (${placeholders}) ${optIn}`,
  )
    .bind(...userIds)
    .all<SubscriptionRow>()
  return sendToSubscriptions(env, results, payload)
}

type ReminderUser = { user_id: string; reminder_minute: number; reminder_days: number; timezone: string; reminder_sent_on: string | null }
type ReminderGroup = { id: string; name: string; timezone: string; start_date: string; end_date: string; last_logged: string | null }

function localClock(timeZone: string, now: Date) {
  const wall = new Date(wallClockMs(timeZone, now))
  return { date: wall.toISOString().slice(0, 10), weekday: wall.getUTCDay(), minute: wall.getUTCHours() * 60 + wall.getUTCMinutes() }
}

type Clock = ReturnType<typeof localClock>

function isDue(user: ReminderUser, clock: Clock): boolean {
  const minutesLate = clock.minute - user.reminder_minute
  return (
    user.reminder_sent_on !== clock.date &&
    (user.reminder_days & (1 << clock.weekday)) !== 0 &&
    minutesLate >= 0 &&
    minutesLate < REMINDER_WINDOW_MINUTES
  )
}

async function groupsToLog(env: Env, userId: string, now: Date): Promise<ReminderGroup[]> {
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.name, g.timezone, go.start_date, go.end_date,
       (SELECT MAX(e.date) FROM entries e WHERE e.goal_id = go.id AND e.user_id = ?1) AS last_logged
     FROM memberships m
     JOIN groups g ON g.id = m.group_id
     JOIN goals go ON go.group_id = g.id AND go.archived_at IS NULL
     WHERE m.user_id = ?1`,
  )
    .bind(userId)
    .all<ReminderGroup>()
  return results.filter((group) => {
    const today = todayIn(group.timezone, now)
    return today >= group.start_date && today <= group.end_date && group.last_logged !== today
  })
}

function reminderPayload(groups: ReminderGroup[]): PushPayload {
  if (groups.length === 1) {
    return { title: 'Time to tally up', body: `Nothing logged for ${groups[0].name} today. Add today's work.`, url: `/g/${groups[0].id}`, tag: 'reminder' }
  }
  return { title: 'Time to tally up', body: `Nothing logged today for ${groups.map((g) => g.name).join(', ')}.`, url: '/groups', tag: 'reminder' }
}

export async function sendReminders(env: Env, now = new Date()) {
  const { results } = await env.DB.prepare(
    `SELECT s.user_id, s.reminder_minute, s.reminder_days, s.timezone, s.reminder_sent_on FROM notification_settings s
     WHERE s.reminders = 1 AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = s.user_id)`,
  ).all<ReminderUser>()
  await Promise.all(
    results
      .map((user) => ({ user, clock: localClock(user.timezone, now) }))
      .filter(({ user, clock }) => isDue(user, clock))
      .map(async ({ user, clock }) => {
        await env.DB.prepare('UPDATE notification_settings SET reminder_sent_on = ? WHERE user_id = ?').bind(clock.date, user.user_id).run()
        const groups = await groupsToLog(env, user.user_id, now)
        if (groups.length > 0) await notifyUsers(env, null, [user.user_id], reminderPayload(groups))
      }),
  )
}
