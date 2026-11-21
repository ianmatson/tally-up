import type { Reaction } from '$shared/api'

export function withReaction(reactions: Reaction[], emoji: string, userId: string, on: boolean): Reaction[] {
  const others = (r: Reaction) => r.userIds.filter((id) => id !== userId)
  if (!on) return reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: others(r) } : r)).filter((r) => r.userIds.length > 0)
  if (!reactions.some((r) => r.emoji === emoji)) return [...reactions, { emoji, userIds: [userId] }]
  return reactions.map((r) => (r.emoji === emoji ? { ...r, userIds: [...others(r), userId] } : r))
}
