import type { GoalDetail } from '$shared/api'
import { addDays, lastLoggableDate } from '$shared/dates'
import { type CreditedEntry, creditEntries } from '$lib/progress'

export type CrownTally = { total: number; overall: number; byComponent: Map<string, number> }

const TIE_PRECISION = 1e12

function dayLeader(entries: CreditedEntry[]): string | null {
  const totals = new Map<string, number>()
  for (const entry of entries) totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.contribution)
  const [first, second] = [...totals]
    .map(([userId, total]) => ({ userId, total: Math.round(total * TIE_PRECISION) }))
    .sort((a, b) => b.total - a.total)
  return first && first.total !== second?.total ? first.userId : null
}

export function crownTallies(goal: Pick<GoalDetail, 'startDate' | 'endDate' | 'components' | 'entries'>, today: string): Map<string, CrownTally> {
  const lastAwardedDay = lastLoggableDate(goal.endDate, addDays(today, -1))
  const entriesByDay = new Map<string, CreditedEntry[]>()
  for (const entry of creditEntries(goal)) {
    if (entry.date > lastAwardedDay || entry.contribution <= 0) continue
    const day = entriesByDay.get(entry.date) ?? []
    day.push(entry)
    entriesByDay.set(entry.date, day)
  }

  const tallies = new Map<string, CrownTally>()
  const tallyFor = (userId: string) => {
    const tally = tallies.get(userId) ?? { total: 0, overall: 0, byComponent: new Map<string, number>() }
    tallies.set(userId, tally)
    tally.total++
    return tally
  }
  for (const entries of entriesByDay.values()) {
    const overall = dayLeader(entries)
    if (overall) tallyFor(overall).overall++
    for (const component of goal.components) {
      const leader = dayLeader(entries.filter((e) => e.componentId === component.id))
      if (!leader) continue
      const { byComponent } = tallyFor(leader)
      byComponent.set(component.id, (byComponent.get(component.id) ?? 0) + 1)
    }
  }
  return tallies
}
