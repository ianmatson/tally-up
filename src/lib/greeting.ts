const MORNING_ENDS = 12
const AFTERNOON_ENDS = 18

export function greeting(name: string, now: Date): string {
  const hour = now.getHours()
  const part = hour < MORNING_ENDS ? 'Morning' : hour < AFTERNOON_ENDS ? 'Afternoon' : 'Evening'
  return `${part}, ${name.split(' ')[0]}`
}
