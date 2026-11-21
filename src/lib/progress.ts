import type { Component, Entry, GoalDetail, Member } from '$shared/api'
import { addDays, DAY_MS, dateMs, daysBetween, lastLoggableDate, todayIn, wallClockMs } from '$shared/dates'

export const BALANCED_COMPONENT_POINTS = 1000
const RECENT_DAYS = 7

export type Period = 'all' | 'recent'

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'recent', label: `${RECENT_DAYS} days` },
]

export function entriesInPeriod(goal: Pick<GoalDetail, 'endDate' | 'entries'>, today: string, period: Period): Entry[] {
  if (period === 'all') return goal.entries
  const cutoff = addDays(lastLoggableDate(goal.endDate, today), -RECENT_DAYS)
  return goal.entries.filter((e) => e.date > cutoff)
}

export function balancedWeight(target: number): number {
  return Number((BALANCED_COMPONENT_POINTS / target).toPrecision(4))
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

function totalsByComponent(entries: Entry[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const entry of entries) totals.set(entry.componentId, (totals.get(entry.componentId) ?? 0) + entry.amount)
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

  const totals = totalsByComponent(goal.entries)
  let earnedPoints = 0
  let possiblePoints = 0
  const components = goal.components.map<ComponentProgress>((component) => {
    const total = totals.get(component.id) ?? 0
    const remaining = Math.max(0, component.target - total)
    earnedPoints += Math.min(total, component.target) * component.weight
    possiblePoints += component.target * component.weight
    return {
      component,
      total,
      fraction: total / component.target,
      aheadBy: total - component.target * elapsedFraction,
      neededPerDay: daysLeft > 0 ? remaining / daysLeft : remaining,
    }
  })

  const overallFraction = possiblePoints > 0 ? earnedPoints / possiblePoints : 0
  return {
    phase,
    today,
    totalDays,
    dayNumber,
    daysLeft,
    elapsedFraction,
    overallFraction,
    daysAhead: (overallFraction - elapsedFraction) * totalDays,
    complete: overallFraction >= 1,
    components,
  }
}

export type MemberScore = {
  member: Member
  points: number
  byComponent: Record<string, { amount: number; points: number }>
}

export function memberScores(members: Member[], components: Component[], entries: Entry[]): MemberScore[] {
  const weights = new Map(components.map((c) => [c.id, c.weight]))
  const scores = new Map<string, MemberScore>(
    members.map((member) => [
      member.id,
      { member, points: 0, byComponent: Object.fromEntries(components.map((c) => [c.id, { amount: 0, points: 0 }])) },
    ]),
  )
  for (const entry of entries) {
    const score = scores.get(entry.userId)
    const weight = weights.get(entry.componentId)
    if (!score || weight === undefined) continue
    score.points += entry.amount * weight
    score.byComponent[entry.componentId].amount += entry.amount
    score.byComponent[entry.componentId].points += entry.amount * weight
  }
  return [...scores.values()]
}

export type Ranked<T> = { item: T; rank: number; value: number; share: number }

export function rankBy<T extends { member: Member }>(items: T[], value: (item: T) => number): Ranked<T>[] {
  const total = items.reduce((sum, item) => sum + value(item), 0)
  const sorted = [...items].sort((a, b) => value(b) - value(a) || a.member.name.localeCompare(b.member.name))
  const ranked: Ranked<T>[] = []
  sorted.forEach((item, i) => {
    const v = value(item)
    const tied = i > 0 && Math.abs(v - ranked[i - 1].value) < 1e-6
    ranked.push({ item, value: v, rank: tied ? ranked[i - 1].rank : i + 1, share: total > 0 ? v / total : 0 })
  })
  return ranked
}
