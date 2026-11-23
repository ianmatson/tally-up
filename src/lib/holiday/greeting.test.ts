import { describe, expect, it } from 'vitest'
import { inHolidaySeason } from './flag'
import { holidayGreeting } from './greeting'

describe('inHolidaySeason', () => {
  it('starts the day after Thanksgiving', () => {
    expect(inHolidaySeason(new Date(2026, 10, 26, 20))).toBe(false)
    expect(inHolidaySeason(new Date(2026, 10, 27, 0))).toBe(true)
    expect(inHolidaySeason(new Date(2027, 10, 25, 12))).toBe(false)
    expect(inHolidaySeason(new Date(2027, 10, 26, 12))).toBe(true)
  })

  it('ends before New Year’s Day', () => {
    expect(inHolidaySeason(new Date(2026, 11, 31, 23, 59))).toBe(true)
    expect(inHolidaySeason(new Date(2027, 0, 1, 0))).toBe(false)
    expect(inHolidaySeason(new Date(2026, 6, 4))).toBe(false)
  })
})

describe('holidayGreeting', () => {
  it('greets on Christmas and New Year’s Eve', () => {
    expect(holidayGreeting(new Date(2026, 11, 25, 9))).toBe('Merry Christmas')
    expect(holidayGreeting(new Date(2026, 11, 31, 20))).toBe('Happy New Year’s Eve')
  })

  it('stays quiet on other days', () => {
    expect(holidayGreeting(new Date(2026, 11, 20))).toBeNull()
    expect(holidayGreeting(new Date(2026, 10, 28))).toBeNull()
  })
})
