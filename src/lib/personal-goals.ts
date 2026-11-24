import type { GoalDetail, GroupDetail } from '$shared/api'
import { addDays, dateMs, daysBetween, todayIn } from '$shared/dates'

const ACTIVITIES = [
  { label: 'pushups', names: ['pushup', 'pushups'], weekly: false },
  { label: 'situps', names: ['situp', 'situps'], weekly: false },
  { label: 'miles', names: ['run', 'running'], weekly: true },
  { label: 'squats', names: ['squat', 'squats'], weekly: false },
] as const

export function personalGoals(group: GroupDetail, goal: GoalDetail, userId: string, now: Date) {
  const today = todayIn(group.timezone, now)
  // achievementsEnabled identifies the existing DG group by its persisted ID.
  if (!group.achievementsEnabled || goal.archived || !group.members.some((m) => m.id === userId)
    || today < goal.startDate || today > goal.endDate) return []

  const totalDays = daysBetween(goal.startDate, goal.endDate) + 1
  const monday = addDays(today, -((new Date(dateMs(today)).getUTCDay() + 6) % 7))

  return ACTIVITIES.flatMap((activity) => {
    const components = goal.components.filter((c) => {
      const name = c.name.toLowerCase().replace(/[\s_-]/g, '')
      return (activity.names as readonly string[]).includes(name)
        && (!activity.weekly || ['mi', 'mile', 'miles'].includes(c.unit.toLowerCase().trim()))
    })
    if (!components.length) return []
    const ids = new Set(components.map((c) => c.id))
    // Use the original even daily share, never the group's catch-up pace.
    const rawTarget = components.reduce((sum, c) => sum + c.target, 0)
      / totalDays / group.members.length * (activity.weekly ? 7 : 1)
    const target = activity.weekly ? rawTarget : Math.ceil(rawTarget)
    const start = activity.weekly ? monday : today
    const logged = goal.entries
      .filter((e) => e.userId === userId && ids.has(e.componentId)
        && e.date >= start && e.date >= goal.startDate && e.date <= today)
      .reduce((sum, e) => sum + e.amount, 0)
    const remaining = Math.max(0, Math.round((target - logged) * 1e6) / 1e6)
    return [{ label: activity.label, period: activity.weekly ? 'this week' : 'today',
      target, logged, remaining: activity.weekly ? Math.ceil(remaining * 10) / 10 : Math.ceil(remaining) }]
  })
}
