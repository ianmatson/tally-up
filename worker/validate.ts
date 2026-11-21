import { HTTPException } from 'hono/http-exception'
import type { ComponentInput, EntryInput, GoalInput } from '../shared/api'
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

function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) badRequest(`${field} must be greater than 0`)
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

export function parseNewGroup(value: unknown): { name: string; timezone: string } {
  const timezone = asBody(value).timezone
  return { name: parseName(value), timezone: typeof timezone === 'string' && isUsableTimeZone(timezone) ? timezone : 'UTC' }
}

function parseComponent(value: unknown): ComponentInput {
  const body = asBody(value)
  return {
    id: typeof body.id === 'string' ? body.id : undefined,
    name: text(body.name, 'Component name'),
    unit: text(body.unit, 'Unit', LIMITS.unit),
    target: positiveNumber(body.target, 'Target'),
    weight: positiveNumber(body.weight, 'Points per unit'),
  }
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
    removedComponentIds: removed.filter((id): id is string => typeof id === 'string'),
  }
}

export function parseEntry(value: unknown): EntryInput {
  const body = asBody(value)
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, LIMITS.note) : null
  if (typeof body.componentId !== 'string') badRequest('Choose what you did')
  return {
    componentId: body.componentId,
    amount: positiveNumber(body.amount, 'Amount'),
    date: isoDate(body.date, 'Date'),
    note,
  }
}
