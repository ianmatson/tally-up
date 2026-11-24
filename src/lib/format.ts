import type { Member } from '$shared/api'
import { addDays, dateMs, daysBetween } from '$shared/dates'
import { firstName, formatNumber } from '$shared/format'

export { firstName, formatNumber }

const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 })
const shareFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekdayDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })

export const formatPercent = (n: number) => percentFormat.format(n)
export const formatShare = (n: number) => shareFormat.format(n)

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

const shortNameCache = new WeakMap<Map<string, Member>, Map<string, string>>()

function shortNames(membersById: Map<string, Member>): Map<string, string> {
  const cached = shortNameCache.get(membersById)
  if (cached) return cached
  const firstNameCounts = new Map<string, number>()
  for (const m of membersById.values()) firstNameCounts.set(firstName(m.name), (firstNameCounts.get(firstName(m.name)) ?? 0) + 1)
  const names = new Map<string, string>()
  for (const m of membersById.values()) {
    const first = firstName(m.name)
    const lastInitial = m.name.split(/\s+/)[1]?.[0]
    names.set(m.id, firstNameCounts.get(first)! > 1 && lastInitial ? `${first} ${lastInitial}.` : first)
  }
  shortNameCache.set(membersById, names)
  return names
}

export function memberLabel(membersById: Map<string, Member>, id: string, userId: string): string {
  return id === userId ? 'You' : (shortNames(membersById).get(id) ?? 'Former member')
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

const localTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const localDateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export const formatDateTime = (timestamp: number) => localDateTime.format(timestamp)
export const formatTime = (timestamp: number) => localTime.format(timestamp)
const localWeekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const localMonthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const WEEK_DAYS = 7

const pad = (n: number) => String(n).padStart(2, '0')

export const formatClockMinutes = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

export function toLocalInput(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatWhen(timestamp: number, now: Date): string {
  const day = toLocalInput(timestamp).slice(0, 10)
  const today = toLocalInput(now.getTime()).slice(0, 10)
  const daysAgo = daysBetween(day, today)
  if (daysAgo === 0) return localTime.format(timestamp)
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < WEEK_DAYS) return localWeekday.format(timestamp)
  return localMonthDay.format(timestamp)
}
