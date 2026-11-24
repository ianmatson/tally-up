import { describe, expect, it } from 'vitest'
import type { Entry, GoalDetail, GroupDetail } from '$shared/api'
import { personalGoals } from './personal-goals'

const group: GroupDetail = {
  id: 'dg', name: 'Renamed DG', timezone: 'America/Chicago', ownerId: 'a', isOwner: true,
  inviteCode: null, goals: [], achievementsEnabled: true,
  members: ['a', 'b'].map((id) => ({ id, name: id, avatarUrl: null, joinedAt: 0 })),
}
const goal: GoalDetail = {
  id: 'goal', name: 'Challenge', startDate: '2026-11-01', endDate: '2026-11-28', archived: false,
  components: [
    { id: 'p', name: 'Pushups', unit: 'reps', target: 2800, weight: 1 },
    { id: 's', name: 'Sit-ups', unit: 'reps', target: 2800, weight: 1 },
    { id: 'm', name: 'Running', unit: 'miles', target: 56, weight: 1 },
    { id: 'q', name: 'Squats', unit: 'reps', target: 5600, weight: 1 },
  ], entries: [],
}
const entry = (componentId: string, amount: number, date: string, userId = 'a'): Entry => ({
  id: `${componentId}-${date}-${userId}`, componentId, amount, date, userId,
  note: null, occurredAt: 0, createdAt: 0, reactions: [], comments: [],
})
const now = new Date('2026-11-25T18:00:00Z')
const remaining = (entries: Entry[], time = now) => personalGoals(group, { ...goal, entries }, 'a', time).map((t) => t.remaining)

describe('DG personal goals', () => {
  it('splits the original goal evenly and extrapolates running to seven days', () => {
    expect(remaining([])).toEqual([50, 50, 7, 100])
  })
  it('subtracts only personal logs in the current day or Monday-based week', () => {
    expect(remaining([
      entry('p', 20, '2026-11-25'), entry('p', 500, '2026-11-24'),
      entry('p', 1000, '2026-11-25', 'b'), entry('s', 5, '2026-11-26'),
      entry('m', 2.25, '2026-11-23'), entry('m', 100, '2026-11-22'),
      entry('q', 120, '2026-11-25'),
    ])).toEqual([30, 50, 4.8, 0])
  })
  it('resets at group midnight and Monday without carrying surplus or debt', () => {
    const entries = [entry('p', 70, '2026-11-22'), entry('m', 10, '2026-11-22')]
    expect(remaining(entries, new Date('2026-11-23T05:59:00Z'))).toEqual([0, 50, 0, 100])
    expect(remaining(entries, new Date('2026-11-23T06:00:00Z'))).toEqual([50, 50, 7, 100])
  })
  it('does not let group catch-up progress change personal targets', () => {
    expect(remaining([entry('p', 2700, '2026-11-24', 'b')])).toEqual(remaining([]))
  })
  it('hides for other groups, nonmembers, archived and inactive goals', () => {
    expect(personalGoals({ ...group, achievementsEnabled: false, name: 'DG (Daddy Gainz)' }, goal, 'a', now)).toEqual([])
    expect(personalGoals(group, goal, 'outsider', now)).toEqual([])
    expect(personalGoals(group, { ...goal, archived: true }, 'a', now)).toEqual([])
    expect(remaining([], new Date('2026-10-31T18:00:00Z'))).toEqual([])
    expect(remaining([], new Date('2026-11-29T18:00:00Z'))).toEqual([])
  })
  it('rounds reps up and avoids floating-point leftovers for completed miles', () => {
    const smallGoal = { ...goal, components: [
      { ...goal.components[0], target: 2801 }, { ...goal.components[2], target: 8 },
    ], entries: Array.from({ length: 10 }, () => entry('m', 0.1, '2026-11-25')) }
    expect(personalGoals(group, smallGoal, 'a', now).map((t) => t.remaining)).toEqual([51, 0])
  })
})
