import { describe, expect, it } from 'vitest'
import type { Entry, GoalDetail, GroupDetail } from '$shared/api'
import { personalGoals } from './personal-goals'

const group: GroupDetail = {
  id: 'dg', name: 'Renamed DG', timezone: 'America/Chicago', isAdmin: true,
  inviteCode: null, goals: [], achievementsEnabled: true,
  members: ['a', 'b'].map((id) => ({ id, name: id, avatarUrl: null, joinedAt: 0, isAdmin: false })),
}
const goal: GoalDetail = {
  id: 'goal', name: 'Challenge', startDate: '2026-11-01', endDate: '2026-11-28', archived: false,
  components: [
    { id: 'p', name: 'Pushups', unit: 'reps', target: 2800, weight: 1, period: 'day' },
    { id: 's', name: 'Sit-ups', unit: 'reps', target: 2800, weight: 1, period: 'day' },
    { id: 'm', name: 'Running', unit: 'miles', target: 56, weight: 1, period: 'week' },
    { id: 'q', name: 'Squats', unit: 'reps', target: 5600, weight: 1, period: 'day' },
  ], entries: [],
}
const entry = (componentId: string, amount: number, date: string, userId = 'a'): Entry => ({
  id: `${componentId}-${date}-${userId}`, amounts: [{ componentId, amount }], date, userId,
  note: null, occurredAt: 0, createdAt: 0, photoUrl: null, reactions: [], comments: [],
})
const now = new Date('2026-11-25T18:00:00Z')
const remaining = (entries: Entry[], time = now) => personalGoals(group, { ...goal, entries }, 'a', time).map((t) => t.remaining)

describe('personal goals', () => {
  it('uses the remaining group pace and extrapolates running to seven days', () => {
    expect(remaining([])).toEqual([350, 350, 49, 700])
  })
  it('subtracts only personal logs in the current day or Monday-based week', () => {
    expect(remaining([
      entry('p', 20, '2026-11-25'), entry('p', 500, '2026-11-24'),
      entry('p', 1000, '2026-11-25', 'b'),
      entry('m', 2.25, '2026-11-23'), entry('m', 1, '2026-11-22'),
      entry('q', 120, '2026-11-25'),
    ])).toEqual([140, 350, 44.75, 565])
  })
  it('resets at group midnight and Monday without carrying surplus or debt', () => {
    const entries = [entry('p', 70, '2026-11-22'), entry('m', 10, '2026-11-22')]
    expect(remaining(entries, new Date('2026-11-23T05:59:00Z'))).toEqual([125, 200, 13, 400])
    expect(remaining(entries, new Date('2026-11-23T06:00:00Z'))).toEqual([228, 234, 27, 467])
  })
  it('updates personal targets when other members change the group pace', () => {
    expect(remaining([entry('p', 2700, '2026-11-24', 'b')])).toEqual([13, 350, 49, 700])
  })
  it('shows 50 of 58 pushups, eight left, when the group pace is 57.8 per day', () => {
    const sixMembers = { ...group, members: Array.from({ length: 6 }, (_, i) => ({ ...group.members[0], id: i === 0 ? 'a' : String(i) })) }
    const screenshotGoal = { ...goal, startDate: '2026-11-25', endDate: '2027-01-02',
      components: [{ ...goal.components[0], target: 13650 }],
      entries: [entry('p', 50, '2026-11-25'), entry('p', 70, '2026-11-25', 'b')] }
    const [target] = personalGoals(sixMembers, screenshotGoal, 'a', now)
    expect([target.logged, target.target, target.remaining]).toEqual([50, 58, 8])
  })
  it('leaves out activities the group has already finished', () => {
    const names = personalGoals(group, { ...goal, entries: [entry('p', 2800, '2026-11-24', 'b')] }, 'a', now).map((t) => t.component.name)
    expect(names).toEqual(['Sit-ups', 'Running', 'Squats'])
  })
  it("lists activities in the goal's saved component order", () => {
    const reordered = { ...goal, components: [goal.components[2], goal.components[0], goal.components[3], goal.components[1]] }
    expect(personalGoals(group, reordered, 'a', now).map((t) => t.component.name)).toEqual(['Running', 'Pushups', 'Squats', 'Sit-ups'])
  })
  it('works in every group and hides for nonmembers, archived and inactive goals', () => {
    expect(remaining([])).toEqual(personalGoals({ ...group, achievementsEnabled: false }, goal, 'a', now).map((t) => t.remaining))
    expect(personalGoals(group, goal, 'outsider', now)).toEqual([])
    expect(personalGoals(group, { ...goal, archived: true }, 'a', now)).toEqual([])
    expect(remaining([], new Date('2026-10-31T18:00:00Z'))).toEqual([])
    expect(remaining([], new Date('2026-11-29T18:00:00Z'))).toEqual([])
  })
  it('rounds reps up and avoids floating-point leftovers for completed miles', () => {
    const smallGoal = { ...goal, components: [
      { ...goal.components[0], target: 2801 }, { ...goal.components[2], target: 2 },
    ], entries: Array.from({ length: 10 }, () => entry('m', 0.1, '2026-11-25')) }
    expect(personalGoals(group, smallGoal, 'a', now).map((t) => t.remaining)).toEqual([351, 0])
  })
  it('counts monthly goals from the first of the month and scales the target to its length', () => {
    const monthly = { ...goal, components: goal.components.map((c) => (c.id === 'q' ? { ...c, period: 'month' as const } : c)),
      entries: [entry('q', 300, '2026-11-02'), entry('q', 50, '2026-11-25'), entry('q', 999, '2026-11-25', 'b')] }
    const squats = personalGoals(group, monthly, 'a', now).find((t) => t.component.id === 'q')!
    expect([squats.period, squats.logged, squats.target]).toEqual(['this month', 350, Math.ceil(((5600 - 1349) / 4 / 2) * 30)])
  })
  it('is not done when a decimal log stays below the shown target', () => {
    const run = { ...goal, components: [{ ...goal.components[2], target: 9.28, period: 'day' as const }], entries: [entry('m', 1.04, '2026-11-25')] }
    const [miles] = personalGoals(group, run, 'a', now)
    expect([miles.target, miles.remaining, miles.done]).toEqual([1.1, 0.06, false])
  })
  it('counts down to the end of the period or the goal, whichever comes first', () => {
    const left = Object.fromEntries(personalGoals(group, goal, 'a', now).map((t) => [t.component.id, t.msLeft / 3_600_000]))
    expect(left).toEqual({ p: 12, s: 12, m: 3 * 24 + 12, q: 12 })
  })
})
