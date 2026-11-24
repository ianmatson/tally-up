import type { GoalDetail, GroupDetail } from '$shared/api'
import { addDays, dateMs, todayIn } from '$shared/dates'
import { goalProgress } from './progress'

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

  const progress = goalProgress(goal, group.timezone, now)
  const monday = addDays(today, -((new Date(dateMs(today)).getUTCDay() + 6) % 7))

  return ACTIVITIES.flatMap((activity) => {
    const components = goal.components.filter((c) => {
      const name = c.name.toLowerCase().replace(/[\s_-]/g, '')
      return (activity.names as readonly string[]).includes(name)
        && (!activity.weekly || ['mi', 'mile', 'miles'].includes(c.unit.toLowerCase().trim()))
    })
    if (!components.length) return []
    const ids = new Set(components.map((c) => c.id))
    // Share the group card's current pace; only this period's personal logs are deducted.
    const target = progress.components
      .filter((item) => ids.has(item.component.id))
      .reduce((sum, item) => sum + item.neededPerDay, 0)
      / group.members.length * (activity.weekly ? 7 : 1)
    const start = activity.weekly ? monday : today
    const logged = goal.entries
      .filter((e) => e.userId === userId && ids.has(e.componentId)
        && e.date >= start && e.date >= goal.startDate && e.date <= today)
      .reduce((sum, e) => sum + e.amount, 0)
    const remaining = Math.max(0, Math.round((target - logged) * 1e6) / 1e6)
    return [{ position: goal.components.indexOf(components[0]), label: activity.label, period: activity.weekly ? 'this week' : 'today',
      target, logged, remaining: activity.weekly ? Math.ceil(remaining * 10) / 10 : Math.ceil(remaining) }]
  }).sort((a, b) => a.position - b.position)
}
