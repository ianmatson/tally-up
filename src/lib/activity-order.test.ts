import { describe, expect, it } from 'vitest'
import type { GoalDetail } from '$shared/api'
import { orderGoalActivities } from './activity-order'

const goal: GoalDetail = {
  id: 'g', name: 'Goal', startDate: '2026-11-01', endDate: '2026-11-30', archived: false, entries: [],
  components: ['Running', 'Plank', 'SQUATS', 'Sit-ups', 'Push ups'].map((name, i) => ({
    id: String(i), name, unit: 'reps', target: 100, weight: 1,
  })),
  crowns: ['mileage', 'squats', 'situps', 'pushups'].map((category) => ({
    category: category as NonNullable<GoalDetail['crowns']>[number]['category'], userId: 'a', total: 10,
  })),
  crownRecords: [{ category: 'mileage', userId: 'a', earnedAt: 1 }, { category: 'pushups', userId: 'a', earnedAt: 2 }],
}

describe('goal activity display order', () => {
  it('orders existing goals, recognizes name variants, and preserves custom positions and component data', () => {
    const ordered = orderGoalActivities(goal)
    expect(ordered.components.map((c) => c.name)).toEqual(['Push ups', 'Plank', 'Sit-ups', 'SQUATS', 'Running'])
    expect(ordered.components.map((c) => c.id)).toEqual(['4', '1', '3', '2', '0'])
    expect(goal.components[0].name).toBe('Running')
    expect(orderGoalActivities(ordered)).toEqual(ordered)
  })
  it('orders current and former exercise crowns without mutating the response', () => {
    const ordered = orderGoalActivities(goal)
    expect(ordered.crowns?.map((c) => c.category)).toEqual(['pushups', 'situps', 'squats', 'mileage'])
    expect(ordered.crownRecords?.map((c) => c.category)).toEqual(['pushups', 'mileage'])
    expect(goal.crowns?.[0].category).toBe('mileage')
  })
  it('supports custom-only goals without achievements', () => {
    const custom = { ...goal, components: [goal.components[1]], crowns: undefined, crownRecords: undefined }
    expect(orderGoalActivities(custom)).toEqual(custom)
  })
})
