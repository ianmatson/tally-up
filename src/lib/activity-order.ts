import type { GoalDetail } from '$shared/api'
import { CROWNS, type CrownId } from '$shared/achievements'

const EXERCISES = [['pushup', 'pushups'], ['situp', 'situps'], ['squat', 'squats'], ['run', 'running']]
const exerciseRank = (name: string) => EXERCISES.findIndex((names) => names.includes(name.toLowerCase().replace(/[\s_-]/g, '')))
const crownOrder = Object.keys(CROWNS) as CrownId[]

/** Order the standard exercises while leaving custom activities in their saved positions. */
export function orderGoalActivities(goal: GoalDetail): GoalDetail {
  const exercises = goal.components.filter((c) => exerciseRank(c.name) >= 0)
    .sort((a, b) => exerciseRank(a.name) - exerciseRank(b.name))
  let index = 0
  const byCrown = (a: { category: CrownId }, b: { category: CrownId }) => crownOrder.indexOf(a.category) - crownOrder.indexOf(b.category)
  return {
    ...goal,
    components: goal.components.map((c) => exerciseRank(c.name) >= 0 ? exercises[index++] : c),
    crowns: goal.crowns?.slice().sort(byCrown),
    crownRecords: goal.crownRecords?.slice().sort(byCrown),
  }
}
