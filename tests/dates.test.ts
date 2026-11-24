import { describe, expect, it } from 'vitest'
import { msUntil, zonedMidnightMs } from '../shared/dates'

const HOUR_MS = 3_600_000

describe('group midnight countdowns', () => {
  it('finds midnight in the group time zone', () => {
    expect(new Date(zonedMidnightMs('2026-11-26', 'America/Chicago')).toISOString()).toBe('2026-11-26T06:00:00.000Z')
    expect(new Date(zonedMidnightMs('2026-07-01', 'America/Chicago')).toISOString()).toBe('2026-07-01T05:00:00.000Z')
  })
  it('counts real hours across clock changes', () => {
    expect(msUntil('2026-03-09', 'America/Chicago', new Date('2026-03-08T06:30:00Z')) / HOUR_MS).toBe(22.5)
    expect(msUntil('2026-11-02', 'America/Chicago', new Date('2026-11-01T05:30:00Z')) / HOUR_MS).toBe(24.5)
  })
})
