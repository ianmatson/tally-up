const ENABLED = true
const NOVEMBER = 10
const DECEMBER = 11
const THURSDAY = 4

function thanksgivingDay(year: number): number {
  const firstWeekday = new Date(year, NOVEMBER, 1).getDay()
  return 1 + ((THURSDAY - firstWeekday + 7) % 7) + 21
}

export function inHolidaySeason(now: Date): boolean {
  const month = now.getMonth()
  return month === DECEMBER || (month === NOVEMBER && now.getDate() > thanksgivingDay(now.getFullYear()))
}

export const HOLIDAY_FLAIR = ENABLED && inHolidaySeason(new Date())
