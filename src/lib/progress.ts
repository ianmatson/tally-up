import type { Component, Entry, EntryAmount, GoalDetail, Member } from '$shared/api'
import { addDays, DAY_MS, dateMs, daysBetween, lastLoggableDate, todayIn, wallClockMs } from '$shared/dates'

const RECENT_DAYS = 7

export type Period = 'all' | 'recent'

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: `${RECENT_DAYS} days` },
]

export function periodRange(goal: Pick<GoalDetail, 'startDate' | 'endDate'>, today: string, period: Period) {
  const end = lastLoggableDate(goal.endDate, today)
  const recentStart = addDays(end, -(RECENT_DAYS - 1))
  const start = period === 'recent' && recentStart > goal.startDate ? recentStart : goal.startDate
  return { start, end }
}

export type EntryLine = Omit<Entry, 'amounts'> & EntryAmount

export const entryLines = (entries: Entry[]): EntryLine[] =>
  entries.flatMap(({ amounts, ...entry }) => amounts.map((line) => ({ ...entry, ...line })))

export function entriesInPeriod<E extends { date: string }>(
  goal: Pick<GoalDetail, 'startDate' | 'endDate'> & { entries: E[] },
  today: string,
  period: Period,
): E[] {
  if (period === 'all') return goal.entries
  const { start } = periodRange(goal, today, period)
  return goal.entries.filter((e) => e.date >= start)
}

export function dateRange(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

export function cumulativeByMember<E extends { userId: string; date: string }>(
  members: Member[],
  entries: E[],
  days: string[],
  valueOf: (entry: E) => number,
): Map<string, number[]> {
  const dayIndex = new Map(days.map((d, i) => [d, i]))
  const daily = new Map(members.map((m) => [m.id, new Array<number>(days.length).fill(0)]))
  const lastDay = days.length - 1
  for (const entry of entries) {
    const row = daily.get(entry.userId)
    if (!row || lastDay < 0) continue
    const i = dayIndex.get(entry.date) ?? (entry.date < days[0] ? 0 : lastDay)
    row[i] += valueOf(entry)
  }
  for (const row of daily.values()) for (let i = 1; i < row.length; i++) row[i] += row[i - 1]
  return daily
}

export function componentShares(components: Component[]): Map<string, number> {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0)
  return new Map(components.map((c) => [c.id, totalWeight > 0 ? c.weight / totalWeight : 0]))
}

export type CreditedEntry = EntryLine & { contribution: number }

const chronologically = (a: EntryLine, b: EntryLine) =>
  a.date.localeCompare(b.date) || a.occurredAt - b.occurredAt || a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

type GoalWindow = Pick<GoalDetail, 'startDate' | 'endDate'>
const inWindow = (goal: GoalWindow, entry: { date: string }) => entry.date >= goal.startDate && entry.date <= goal.endDate

export function creditEntries(goal: GoalWindow & Pick<GoalDetail, 'components' | 'entries'>): CreditedEntry[] {
  const { components, entries } = goal
  const shares = componentShares(components)
  const targets = new Map(components.map((c) => [c.id, c.target]))
  const loggedSoFar = new Map<string, number>()
  const contributions = new Map<EntryLine, number>()
  const counted = entryLines(entries).filter((e) => inWindow(goal, e))
  for (const entry of [...counted].sort(chronologically)) {
    const target = targets.get(entry.componentId)
    if (target === undefined) continue
    const before = loggedSoFar.get(entry.componentId) ?? 0
    loggedSoFar.set(entry.componentId, before + entry.amount)
    const counted = Math.max(0, Math.min(entry.amount, target - before))
    contributions.set(entry, (counted / target) * shares.get(entry.componentId)!)
  }
  return counted.map((entry) => ({ ...entry, contribution: contributions.get(entry) ?? 0 }))
}

export type ComponentProgress = {
  component: Component
  total: number
  fraction: number
  aheadBy: number
  neededPerDay: number
}

export type GoalProgress = {
  phase: 'upcoming' | 'active' | 'finished'
  today: string
  totalDays: number
  dayNumber: number
  daysLeft: number
  elapsedFraction: number
  overallFraction: number
  daysAhead: number
  complete: boolean
  components: ComponentProgress[]
}

const FLOAT_PRECISION = 1e6

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function totalsByComponent(goal: GoalWindow & { entries: Entry[] }): Map<string, number> {
  const totals = new Map<string, number>()
  for (const entry of entryLines(goal.entries).filter((e) => inWindow(goal, e))) totals.set(entry.componentId, (totals.get(entry.componentId) ?? 0) + entry.amount)
  for (const [id, total] of totals) totals.set(id, Math.round(total * FLOAT_PRECISION) / FLOAT_PRECISION)
  return totals
}

export function goalProgress(
  goal: Pick<GoalDetail, 'startDate' | 'endDate' | 'components' | 'entries'>,
  timeZone: string,
  now = new Date(),
): GoalProgress {
  const today = todayIn(timeZone, now)
  const totalDays = daysBetween(goal.startDate, goal.endDate) + 1
  const phase = today < goal.startDate ? 'upcoming' : today > goal.endDate ? 'finished' : 'active'
  const elapsedFraction = clamp01((wallClockMs(timeZone, now) - dateMs(goal.startDate)) / (totalDays * DAY_MS))
  const dayNumber = Math.min(totalDays, Math.max(0, daysBetween(goal.startDate, today) + 1))
  const daysLeft = phase === 'upcoming' ? totalDays : Math.max(0, daysBetween(today, goal.endDate) + 1)

  const totals = totalsByComponent(goal)
  const shares = componentShares(goal.components)
  let overallFraction = 0
  const components = goal.components.map<ComponentProgress>((component) => {
    const total = totals.get(component.id) ?? 0
    const remaining = Math.max(0, component.target - total)
    overallFraction += clamp01(total / component.target) * shares.get(component.id)!
    return {
      component,
      total,
      fraction: total / component.target,
      aheadBy: total - component.target * elapsedFraction,
      neededPerDay: daysLeft > 0 ? remaining / daysLeft : remaining,
    }
  })

  return {
    phase,
    today,
    totalDays,
    dayNumber,
    daysLeft,
    elapsedFraction,
    overallFraction,
    daysAhead: (overallFraction - elapsedFraction) * totalDays,
    complete: components.length > 0 && components.every((c) => c.total >= c.component.target),
    components,
  }
}

export function dailyGroupProgress(goal: Pick<GoalDetail, 'startDate' | 'endDate' | 'components' | 'entries'>, today: string): number[] {
  if (today < goal.startDate) return []
  const days = dateRange(goal.startDate, lastLoggableDate(goal.endDate, today))
  const shares = componentShares(goal.components)
  const loggedByDay = new Map(days.map((day) => [day, new Map<string, number>()]))
  for (const entry of entryLines(goal.entries)) {
    const day = loggedByDay.get(entry.date)
    if (day && shares.has(entry.componentId)) day.set(entry.componentId, (day.get(entry.componentId) ?? 0) + entry.amount)
  }
  const cumulative = new Map<string, number>()
  return days.map((day) => {
    for (const [id, amount] of loggedByDay.get(day)!) cumulative.set(id, (cumulative.get(id) ?? 0) + amount)
    return goal.components.reduce((sum, c) => sum + clamp01((cumulative.get(c.id) ?? 0) / c.target) * shares.get(c.id)!, 0)
  })
}

export type MemberScore = {
  member: Member
  contribution: number
  byComponent: Record<string, { amount: number; contribution: number }>
}

export function memberScores(members: Member[], components: Component[], entries: CreditedEntry[]): MemberScore[] {
  const scores = new Map<string, MemberScore>(
    members.map((member) => [
      member.id,
      { member, contribution: 0, byComponent: Object.fromEntries(components.map((c) => [c.id, { amount: 0, contribution: 0 }])) },
    ]),
  )
  for (const entry of entries) {
    const score = scores.get(entry.userId)
    const part = score?.byComponent[entry.componentId]
    if (!score || !part) continue
    score.contribution += entry.contribution
    part.amount += entry.amount
    part.contribution += entry.contribution
  }
  return [...scores.values()]
}

export type Ranked<T> = { item: T; rank: number; value: number }

export function rankBy<T extends { member: Member }>(items: T[], value: (item: T) => number): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => value(b) - value(a) || a.member.name.localeCompare(b.member.name))
  const ranked: Ranked<T>[] = []
  sorted.forEach((item, i) => {
    const v = value(item)
    const tied = i > 0 && Math.abs(v - ranked[i - 1].value) < 1e-6
    ranked.push({ item, value: v, rank: tied ? ranked[i - 1].rank : i + 1 })
  })
  return ranked
}
