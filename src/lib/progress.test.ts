import { describe, expect, it } from 'vitest'
import type { Component, Entry, Member } from '$shared/api'
import { balancedWeight, goalProgress, memberScores, rankBy } from './progress'

const pushups: Component = { id: 'p', name: 'Pushups', unit: 'reps', target: 10000, weight: 0.1 }
const miles: Component = { id: 'm', name: 'Run', unit: 'miles', target: 50, weight: 20 }
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
})

describe('goalProgress', () => {
  it('reports days behind from the points-weighted overall progress', () => {
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

describe('memberScores and rankBy', () => {
  const members: Member[] = [
    { id: 'a', name: 'Ana', avatarUrl: null },
    { id: 'b', name: 'Ben', avatarUrl: null },
    { id: 'c', name: 'Cy', avatarUrl: null },
  ]

  it('ranks by weighted points, so hard components count for more', () => {
    const tinyPushupGoal = { ...pushups, target: 10, weight: balancedWeight(10) }
    const hugeRunGoal = { ...miles, target: 1000, weight: balancedWeight(1000) }
    const scores = memberScores(members, [tinyPushupGoal, hugeRunGoal], [entry('a', 'p', 10), entry('b', 'm', 1000)])
    const board = rankBy(scores, (s) => s.points)

    expect(board.map((r) => [r.item.member.id, r.value, r.rank])).toEqual([
      ['a', 1000, 1],
      ['b', 1000, 1],
      ['c', 0, 3],
    ])
  })

  it('reports each member share of the group points and per-component breakdown', () => {
    const scores = memberScores(members, [pushups, miles], [entry('a', 'p', 300), entry('a', 'm', 3), entry('b', 'p', 300)])
    const board = rankBy(scores, (s) => s.points)
    expect(board[0].item.member.id).toBe('a')
    expect(board[0].value).toBeCloseTo(90)
    expect(board[0].share).toBeCloseTo(0.75)
    expect(board[0].item.byComponent.m).toEqual({ amount: 3, points: 60 })
    expect(board[1].share).toBeCloseTo(0.25)
  })
})
