import { addDays, dateMs } from '$shared/dates'

const preciseFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const wholeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const WHOLE_NUMBER_THRESHOLD = 100
const weightFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 })
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekdayDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

export const formatNumber = (n: number) => (Math.abs(n) >= WHOLE_NUMBER_THRESHOLD ? wholeFormat : preciseFormat).format(n)
export const formatPoints = (n: number) => wholeFormat.format(n)
export const formatWeight = (n: number) => weightFormat.format(n)
export const formatPercent = (n: number) => percentFormat.format(n)

const utcDate = (date: string) => new Date(dateMs(date))

export const formatDate = (date: string) => shortDate.format(utcDate(date))

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return weekdayDate.format(utcDate(date))
}

export const roundDays = (days: number) => Math.round(Math.abs(days) * 10) / 10

export const dayWord = (days: number) => (days === 1 ? 'day' : 'days')

export function formatDays(days: number): string {
  const rounded = roundDays(days)
  return `${formatNumber(rounded)} ${dayWord(rounded)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatMembers(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`
}
