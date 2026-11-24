import type { Component, ComponentPeriod, GoalDetail, GroupDetail } from '$shared/api'
import { addDays, dateMs, daysBetween, msUntil, todayIn } from '$shared/dates'
import { entryLines, goalProgress } from './progress'

const FLOAT_PRECISION = 1e6
const WHOLE_UNIT_FROM = 10
const DAYS_PER_WEEK = 7

const PERIOD_LABELS: Record<ComponentPeriod, string> = { day: 'today', week: 'this week', month: 'this month' }

const clean = (n: number) => Math.round(n * FLOAT_PRECISION) / FLOAT_PRECISION
const roundUp = (n: number) => (n >= WHOLE_UNIT_FROM ? Math.ceil(n) : Math.ceil(n * 10) / 10)

function periodRange(period: ComponentPeriod, today: string): { start: string; days: number } {
  if (period === 'day') return { start: today, days: 1 }
  if (period === 'week') return { start: addDays(today, -((new Date(dateMs(today)).getUTCDay() + 6) % 7)), days: DAYS_PER_WEEK }
  const start = `${today.slice(0, 8)}01`
  const date = new Date(dateMs(start))
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  return { start, days: daysBetween(start, nextMonth) }
}

export type PersonalGoal = { component: Component; period: string; target: number; logged: number; remaining: number; done: boolean; msLeft: number }

export function personalGoals(group: GroupDetail, goal: GoalDetail, userId: string, now: Date): PersonalGoal[] {
  const today = todayIn(group.timezone, now)
  if (goal.archived || !group.members.some((m) => m.id === userId) || today < goal.startDate || today > goal.endDate) return []

  const progress = goalProgress(goal, group.timezone, now)
  const mine = entryLines(goal.entries).filter((e) => e.userId === userId && e.date >= goal.startDate && e.date <= today)
  return progress.components.flatMap(({ component, neededPerDay }) => {
    const { start, days } = periodRange(component.period, today)
    const target = roundUp(clean((neededPerDay / group.members.length) * days))
    if (target === 0) return []
    const logged = clean(
      mine
        .filter((e) => e.componentId === component.id && e.date >= start)
        .reduce((sum, e) => sum + e.amount, 0),
    )
    const remaining = clean(Math.max(0, target - logged))
    const end = [addDays(start, days), addDays(goal.endDate, 1)].sort()[0]
    const msLeft = msUntil(end, group.timezone, now)
    return [{ component, period: PERIOD_LABELS[component.period], target, logged, remaining, done: remaining === 0, msLeft }]
  })
}
