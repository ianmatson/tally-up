import { addDays } from './dates'

export const TITLES = [
  { id: 'initiate', name: 'Initiate', days: 1 },
  { id: 'acolyte', name: 'Tally Acolyte', days: 3 },
  { id: 'disciple', name: 'Tally Disciple', days: 7 },
  { id: 'veteran', name: 'Tally Veteran', days: 14 },
  { id: 'legend', name: 'Tally Legend', days: 28 },
] as const
export type TitleId = (typeof TITLES)[number]['id']
export const titleName = (id?: string | null) => TITLES.find((t) => t.id === id)?.name

export type EarnedTitle = { userId: string; titleId: TitleId; earnedAt: number }

/** A streak remains live until the user misses a complete calendar day. */
export function currentStreak(dates: string[], today: string): number {
  const days = new Set(dates.filter((d) => d <= today))
  let day = days.has(today) ? today : addDays(today, -1)
  let count = 0
  while (days.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}
