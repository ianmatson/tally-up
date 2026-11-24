import { HTTPException } from 'hono/http-exception'
import { COMPONENT_PERIODS, type ComponentInput, type ComponentPeriod, type EntryInput, type GoalInput, type PushSubscriptionInput } from '../shared/api'
import { daysBetween, isIsoDate } from '../shared/dates'
import { LIMITS } from '../shared/limits'

export function badRequest(message: string): never {
  throw new HTTPException(400, { message })
}

type Body = Record<string, unknown>

function asBody(value: unknown): Body {
  if (!value || typeof value !== 'object') badRequest('Expected a JSON object')
  return value as Body
}

function text(value: unknown, field: string, max: number = LIMITS.name): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed.length > max) badRequest(`${field} must be 1 to ${max} characters`)
  return trimmed
}

function positiveNumber(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) badRequest(`${field} must be greater than 0`)
  if (value > max) badRequest(`${field} must be at most ${max.toLocaleString('en-US')}`)
  return value
}

function timestamp(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) badRequest(`${field} must be a valid date and time`)
  return value
}

function isoDate(value: unknown, field: string): string {
  if (!isIsoDate(value)) badRequest(`${field} must be a valid date`)
  return value
}

export function parseName(value: unknown): string {
  return text(asBody(value).name, 'Group name')
}

function isUsableTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

const timeZoneOrUtc = (value: unknown) => (typeof value === 'string' && isUsableTimeZone(value) ? value : 'UTC')

export function parseNewGroup(value: unknown): { name: string; timezone: string } {
  return { name: parseName(value), timezone: timeZoneOrUtc(asBody(value).timezone) }
}

function parseComponent(value: unknown): ComponentInput {
  const body = asBody(value)
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    name: text(body.name, 'Component name'),
    unit: text(body.unit, 'Unit', LIMITS.unit),
    target: positiveNumber(body.target, 'Target', LIMITS.target),
    weight: positiveNumber(body.weight, 'Share of goal', LIMITS.amount),
    period: parsePeriod(body.period),
  }
}

function parsePeriod(value: unknown): ComponentPeriod | undefined {
  if (value === undefined) return undefined
  return COMPONENT_PERIODS.find((p) => p === value) ?? badRequest('Choose daily, weekly or monthly')
}

export function parseGoal(value: unknown): GoalInput {
  const body = asBody(value)
  const startDate = isoDate(body.startDate, 'Start date')
  const endDate = isoDate(body.endDate, 'End date')
  const length = daysBetween(startDate, endDate) + 1
  if (length < 1) badRequest('End date must be on or after the start date')
  if (length > LIMITS.goalDays) badRequest(`A goal can be at most ${LIMITS.goalDays} days long`)
  if (!Array.isArray(body.components) || body.components.length < 1 || body.components.length > LIMITS.components) {
    badRequest(`A goal needs 1 to ${LIMITS.components} components`)
  }
  const removed = Array.isArray(body.removedComponentIds) ? body.removedComponentIds : []
  return {
    name: text(body.name, 'Goal name'),
    startDate,
    endDate,
    components: body.components.map(parseComponent),
    removedComponentIds: removed.filter((id): id is string => typeof id === 'string').slice(0, LIMITS.components),
  }
}

export function parseEntry(value: unknown): EntryInput {
  const body = asBody(value)
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, LIMITS.note) : null
  if (typeof body.componentId !== 'string') badRequest('Choose what you did')
  return {
    componentId: body.componentId,
    amount: positiveNumber(body.amount, 'Amount', LIMITS.amount),
    occurredAt: timestamp(body.occurredAt, 'Time'),
    note,
  }
}

export function parseComment(value: unknown): string {
  return text(asBody(value).body, 'Comment', LIMITS.comment)
}

const MINUTES_PER_DAY = 1440
export const ALL_DAYS_MASK = 127

function integerIn(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) badRequest(`${field} is not valid`)
  return value
}

export type SettingsChange = { timezone: string; columns: [column: string, value: number | string][] }

export function parseSettingsChange(value: unknown): SettingsChange {
  const body = asBody(value)
  const timezone = timeZoneOrUtc(body.timezone)
  const columns: SettingsChange['columns'] = []
  const flag = (key: string) => {
    if (key in body) columns.push([key, body[key] === true ? 1 : 0])
  }
  flag('reminders')
  flag('contributions')
  flag('comments')
  if ('reminderMinute' in body) columns.push(['reminder_minute', integerIn(body.reminderMinute, 'Reminder time', MINUTES_PER_DAY - 1)])
  if ('reminderDays' in body) columns.push(['reminder_days', integerIn(body.reminderDays, 'Reminder days', ALL_DAYS_MASK)])
  if (['reminders', 'reminderMinute', 'reminderDays'].some((key) => key in body)) columns.push(['timezone', timezone])
  return { timezone, columns }
}

const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com']

function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) return false
  const url = new URL(value)
  return url.protocol === 'https:' && PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
}

export function parseSubscription(value: unknown): PushSubscriptionInput & { timezone: string } {
  const body = asBody(value)
  const keys = asBody(body.keys)
  if (!isPushEndpoint(body.endpoint)) badRequest('Push endpoint is not valid')
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') badRequest('Push keys are not valid')
  return { endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, timezone: timeZoneOrUtc(body.timezone) }
}

export function parseEndpoint(value: unknown): string {
  const endpoint = asBody(value).endpoint
  if (typeof endpoint !== 'string') badRequest('Push endpoint is not valid')
  return endpoint
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX = 254
const LOGIN_CODE_PATTERN = new RegExp(`^\\d{${LIMITS.loginCode}}$`)

function email(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized.length > EMAIL_MAX || !EMAIL_PATTERN.test(normalized)) badRequest('Enter a valid email address')
  return normalized
}

export function parseEmailStart(value: unknown): string {
  return email(asBody(value).email)
}

export function parseEmailCode(value: unknown): { email: string; code: string } {
  const body = asBody(value)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!LOGIN_CODE_PATTERN.test(code)) badRequest('Enter the 6-digit code')
  return { email: email(body.email), code }
}

export function parseProfile(value: unknown): string {
  return text(asBody(value).name, 'Name')
}
