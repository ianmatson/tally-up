import { describe, expect, it } from 'vitest'
import type { Component, Entry } from '$shared/api'
import { crownTallies, todaysStandings } from './crowns'

const pushups: Component = { id: 'p', name: 'Pushups', unit: 'reps', target: 100, weight: 50, period: 'day' }
const miles: Component = { id: 'm', name: 'Run', unit: 'miles', target: 10, weight: 50, period: 'day' }
const goal = (entries: Entry[]) => ({ startDate: '2026-12-01', endDate: '2026-12-31', components: [pushups, miles], entries })

let nextId = 0
const entry = (userId: string, componentId: string, amount: number, date: string): Entry => ({
  id: String(nextId++),
  userId,
  componentId,
  amount,
  date,
  note: null,
  occurredAt: 0,
  createdAt: nextId,
  photoUrl: null,
  reactions: [],
  comments: [],
})

const summary = (tallies: ReturnType<typeof crownTallies>) =>
  Object.fromEntries([...tallies].map(([userId, t]) => [userId, { total: t.total, overall: t.overall, ...Object.fromEntries(t.byComponent) }]))

describe('daily crowns', () => {
  it('awards the overall and each activity leader for every finished day and accumulates them', () => {
    const entries = [
      entry('a', 'p', 20, '2026-12-01'),
      entry('b', 'm', 1, '2026-12-01'),
      entry('b', 'p', 5, '2026-12-02'),
      entry('a', 'm', 2, '2026-12-02'),
    ]
    expect(summary(crownTallies(goal(entries), '2026-12-03'))).toEqual({
      a: { total: 4, overall: 2, p: 1, m: 1 },
      b: { total: 2, p: 1, m: 1, overall: 0 },
    })
  })

  it('waits for the day to end and stops at the goal end date', () => {
    const entries = [entry('a', 'p', 20, '2026-12-03'), entry('a', 'p', 1, '2026-12-31')]
    expect(crownTallies(goal(entries), '2026-12-03').size).toBe(0)
    expect(crownTallies(goal(entries), '2027-02-01').get('a')?.total).toBe(4)
  })

  it('awards no crown on a tie or when logs no longer count toward a reached target', () => {
    const entries = [
      entry('a', 'p', 10, '2026-12-01'),
      entry('b', 'p', 6, '2026-12-01'),
      entry('b', 'p', 4, '2026-12-01'),
      entry('a', 'p', 90, '2026-12-02'),
      entry('b', 'p', 50, '2026-12-03'),
    ]
    expect(summary(crownTallies(goal(entries), '2026-12-10'))).toEqual({ a: { total: 2, overall: 1, p: 1 } })
  })

  it("shows today's leaders and ties for each category", () => {
    const entries = [entry('a', 'p', 10, '2026-12-05'), entry('b', 'p', 10, '2026-12-05'), entry('b', 'm', 1, '2026-12-05'), entry('a', 'm', 9, '2026-12-04')]
    const standings = todaysStandings(goal(entries), '2026-12-05')
    expect(standings.overall).toEqual({ userIds: ['b'], contribution: 0.1 })
    expect(standings.byComponent.get('p')).toEqual({ userIds: ['a', 'b'], contribution: 0.05 })
    expect(standings.byComponent.get('m')).toEqual({ userIds: ['b'], contribution: 0.05 })
  })
})
