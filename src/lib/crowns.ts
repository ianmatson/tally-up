import type { GoalDetail } from '$shared/api'
import { addDays, lastLoggableDate } from '$shared/dates'
import { type CreditedEntry, creditEntries } from '$lib/progress'

export type CrownTally = { total: number; overall: number; byComponent: Map<string, number> }

const TIE_PRECISION = 1e12

export type Standing = { userIds: string[]; contribution: number }

function dayPlaces(entries: CreditedEntry[]): Standing[] {
  const totals = new Map<string, number>()
  for (const entry of entries) totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.contribution)
  const places = new Map<number, string[]>()
  for (const [userId, total] of totals) {
    const rounded = Math.round(total * TIE_PRECISION)
    if (rounded > 0) places.set(rounded, [...(places.get(rounded) ?? []), userId])
  }
  return [...places]
    .sort(([a], [b]) => b - a)
    .map(([rounded, userIds]) => ({ userIds, contribution: rounded / TIE_PRECISION }))
}

const soleLeader = (entries: CreditedEntry[]) => {
  const [first] = dayPlaces(entries)
  return first?.userIds.length === 1 ? first.userIds[0] : null
}

const countedOn = (entries: CreditedEntry[], day: string) => entries.filter((e) => e.date === day && e.contribution > 0)

export function todaysStandings(goal: Pick<GoalDetail, 'startDate' | 'endDate' | 'components' | 'entries'>, today: string) {
  const entries = countedOn(creditEntries(goal), today)
  return {
    overall: dayPlaces(entries),
    byComponent: new Map(goal.components.map((c) => [c.id, dayPlaces(entries.filter((e) => e.componentId === c.id))])),
  }
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
    const overall = soleLeader(entries)
    if (overall) tallyFor(overall).overall++
    for (const component of goal.components) {
      const leader = soleLeader(entries.filter((e) => e.componentId === component.id))
      if (!leader) continue
      const { byComponent } = tallyFor(leader)
      byComponent.set(component.id, (byComponent.get(component.id) ?? 0) + 1)
    }
  }
  return tallies
}
