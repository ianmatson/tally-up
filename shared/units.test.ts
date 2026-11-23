import { describe, expect, it } from 'vitest'
import { formatAmount, unitPlural, unitSingular } from './units'

describe('units', () => {
  it('matches the amount whichever form the admin typed', () => {
    expect(formatAmount(1, 'reps')).toBe('1 rep')
    expect(formatAmount(10000, 'rep')).toBe('10,000 reps')
    expect(formatAmount(0.9, 'mile')).toBe('0.9 miles')
    expect(formatAmount(1, 'Miles')).toBe('1 Mile')
    expect(formatAmount(0, 'lap')).toBe('0 laps')
  })

  it('handles irregular words', () => {
    expect(formatAmount(3, 'foot')).toBe('3 feet')
    expect(formatAmount(2, 'press')).toBe('2 presses')
    expect(formatAmount(1, 'push-ups')).toBe('1 push-up')
  })

  it('keeps abbreviations and phrases as typed', () => {
    expect(formatAmount(5, 'km')).toBe('5 km')
    expect(formatAmount(20, 'min')).toBe('20 min')
    expect(formatAmount(2, 'glasses of water')).toBe('2 glasses of water')
  })

  it('gives labels for per-unit and column text', () => {
    expect(unitSingular('reps')).toBe('rep')
    expect(unitPlural('mile')).toBe('miles')
  })
})
