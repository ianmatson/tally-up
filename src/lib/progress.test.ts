import { describe, expect, it } from 'vitest'
import type { Component, Entry, Member } from '$shared/api'
import { creditEntries, cumulativeByMember, dailyGroupProgress, dateRange, goalProgress, memberScores, periodRange, rankBy } from './progress'

const pushups: Component = { id: 'p', name: 'Pushups', unit: 'reps', target: 10000, weight: 50, period: 'day' }
const miles: Component = { id: 'm', name: 'Run', unit: 'miles', target: 50, weight: 50, period: 'day' }
const period = { startDate: '2026-12-01', endDate: '2026-12-31' }
const goal = (components: Component[], entries: Entry[] = []) => ({ ...period, components, entries })

let nextId = 0
const entry = (userId: string, componentId: string, amount: number, date = '2026-12-02'): Entry => ({
  id: String(nextId++),
  userId,
  componentId,
  amount,
  date,
  note: null,
  occurredAt: 0,
  createdAt: 0,
  photoUrl: null,
  reactions: [],
  comments: [],
})

describe('goalProgress', () => {
  it('reports days behind from the weighted overall progress', () => {
    const noonDec16 = new Date('2026-12-16T12:00:00Z')
    const progress = goalProgress(goal([pushups, miles], [entry('a', 'p', 5000), entry('a', 'm', 10)]), 'UTC', noonDec16)

    expect(progress.phase).toBe('active')
    expect(progress.dayNumber).toBe(16)
    expect(progress.daysLeft).toBe(16)
    expect(progress.elapsedFraction).toBeCloseTo(15.5 / 31)
    expect(progress.overallFraction).toBeCloseTo(0.35)
    expect(progress.daysAhead).toBeCloseTo(0.35 * 31 - 15.5)
    expect(progress.components[1].aheadBy).toBeCloseTo(10 - 25)
    expect(progress.components[1].neededPerDay).toBeCloseTo(40 / 16)
  })

  it('marks the goal complete when every component reaches its target, whatever the shares', () => {
    const shares = [20, 70, 10].map((weight, i) => ({ ...pushups, id: String(i), target: 10, weight }))
    const progress = goalProgress(goal(shares, shares.map((c) => entry('a', c.id, 10))), 'UTC', new Date('2026-12-16T12:00:00Z'))
    expect(progress.complete).toBe(true)
  })

  it('caps each component at its target in the overall progress', () => {
    const progress = goalProgress(goal([pushups, miles], [entry('a', 'p', 20000)]), 'UTC', new Date('2026-12-10T00:00:00Z'))
    expect(progress.overallFraction).toBeCloseTo(0.5)
    expect(progress.components[0].fraction).toBe(2)
  })

  it('treats many decimal logs that add up to the target as complete', () => {
    const mile = { ...miles, target: 1 }
    const tenths = Array.from({ length: 10 }, () => entry('a', 'm', 0.1))
    const progress = goalProgress(goal([mile], tenths), 'UTC', new Date('2026-12-10T00:00:00Z'))
    expect(progress.complete).toBe(true)
  })

  it('uses the group time zone to decide the day', () => {
    const lateDec31InLosAngeles = new Date('2027-01-01T05:00:00Z')
    expect(goalProgress(goal([miles]), 'America/Los_Angeles', lateDec31InLosAngeles).phase).toBe('active')
    expect(goalProgress(goal([miles]), 'UTC', lateDec31InLosAngeles).phase).toBe('finished')
  })

  it('expects nothing before the goal starts', () => {
    const progress = goalProgress(goal([miles]), 'UTC', new Date('2026-11-20T00:00:00Z'))
    expect(progress.phase).toBe('upcoming')
    expect(progress.daysAhead).toBe(0)
    expect(progress.daysLeft).toBe(31)
  })
})

describe('dailyGroupProgress', () => {
  it('tracks weighted, capped group progress for each day through today', () => {
    const entries = [entry('a', 'p', 5000, '2026-12-01'), entry('b', 'm', 100, '2026-12-03'), entry('a', 'p', 9000, '2026-12-03')]
    expect(dailyGroupProgress(goal([pushups, miles], entries), '2026-12-04')).toEqual([0.25, 0.25, 1, 1])
    expect(dailyGroupProgress(goal([pushups, miles], entries), '2026-11-30')).toEqual([])
    expect(dailyGroupProgress(goal([pushups, miles], entries), '2027-01-09')).toHaveLength(31)
  })
})

describe('memberScores and rankBy', () => {
  const members: Member[] = [
    { id: 'a', name: 'Ana', avatarUrl: null, joinedAt: 0, isAdmin: false },
    { id: 'b', name: 'Ben', avatarUrl: null, joinedAt: 0, isAdmin: false },
    { id: 'c', name: 'Cy', avatarUrl: null, joinedAt: 0, isAdmin: false },
  ]

  const score = (components: Component[], entries: Entry[]) =>
    rankBy(memberScores(members, components, creditEntries(goal(components, entries))), (s) => s.contribution)

  it('ranks by share of the goal, so each component counts by its weight rather than its size', () => {
    const tinyPushupGoal = { ...pushups, target: 10, weight: 1 }
    const hugeRunGoal = { ...miles, target: 1000, weight: 1 }
    const board = score([tinyPushupGoal, hugeRunGoal], [entry('a', 'p', 10), entry('b', 'm', 1000)])

    expect(board.map((r) => [r.item.member.id, r.value, r.rank])).toEqual([
      ['a', 0.5, 1],
      ['b', 0.5, 1],
      ['c', 0, 3],
    ])
  })

  it('credits only logs that fill a component target, in date order', () => {
    const smallPushups = { ...pushups, target: 100, weight: 75 }
    const smallRun = { ...miles, target: 10, weight: 25 }
    const entries = [
      entry('c', 'p', 10, '2026-12-03'),
      entry('b', 'p', 60, '2026-12-02'),
      entry('a', 'p', 60, '2026-12-01'),
      entry('a', 'm', 5, '2026-12-01'),
      entry('c', 'm', 5, '2026-11-30'),
    ]
    const board = score([smallPushups, smallRun], entries)

    expect(board.map((r) => [r.item.member.id, r.value])).toEqual([
      ['a', 0.575],
      ['b', expect.closeTo(0.3)],
      ['c', 0],
    ])
    expect(board[1].item.byComponent.p).toEqual({ amount: 60, contribution: expect.closeTo(0.3) })
    expect(board[2].item.byComponent.m).toEqual({ amount: 0, contribution: 0 })
    expect(board.reduce((sum, r) => sum + r.value, 0)).toBeCloseTo(goalProgress(goal([smallPushups, smallRun], entries), 'UTC').overallFraction)
  })
})

describe('chart series', () => {
  it('builds cumulative totals per member per day, folding out-of-range entries into the ends', () => {
    const days = dateRange('2026-12-01', '2026-12-03')
    const series = cumulativeByMember(
      [{ id: 'a', name: 'Ana', avatarUrl: null, joinedAt: 0, isAdmin: false }],
      [entry('a', 'p', 10, '2026-12-01'), entry('a', 'p', 5, '2026-12-03'), entry('a', 'p', 99, '2026-11-30'), entry('a', 'p', 1, '2026-12-09')],
      days,
      (e) => e.amount,
    )
    expect(days).toEqual(['2026-12-01', '2026-12-02', '2026-12-03'])
    expect(series.get('a')).toEqual([109, 109, 115])
  })

  it('limits the recent period to the last seven loggable days', () => {
    expect(periodRange(period, '2026-12-20', 'recent')).toEqual({ start: '2026-12-14', end: '2026-12-20' })
    expect(periodRange(period, '2026-12-03', 'recent')).toEqual({ start: '2026-12-01', end: '2026-12-03' })
    expect(periodRange(period, '2027-01-05', 'all')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })
})
