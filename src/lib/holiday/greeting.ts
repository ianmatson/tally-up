const CHRISTMAS_DAYS = [24, 25, 26]
const NEW_YEARS_EVE = 31

export function holidayGreeting(now: Date): string | null {
  if (now.getMonth() !== 11) return null
  if (CHRISTMAS_DAYS.includes(now.getDate())) return 'Merry Christmas'
  if (now.getDate() === NEW_YEARS_EVE) return 'Happy New Year’s Eve'
  return null
}
