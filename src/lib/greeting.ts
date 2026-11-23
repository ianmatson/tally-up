import { firstName } from './format'
import { HOLIDAY_FLAIR } from './holiday/flag'
import { holidayGreeting } from './holiday/greeting'

const MORNING_ENDS = 12
const AFTERNOON_ENDS = 18

export function greeting(name: string, now: Date): string {
  const hour = now.getHours()
  const holiday = HOLIDAY_FLAIR ? holidayGreeting(now) : null
  if (holiday) return `${holiday}, ${firstName(name)}`
  const part = hour < MORNING_ENDS ? 'Morning' : hour < AFTERNOON_ENDS ? 'Afternoon' : 'Evening'
  return `${part}, ${firstName(name)}`
}
