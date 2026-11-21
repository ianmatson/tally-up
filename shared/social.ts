export const REACTIONS = ['👍', '🔥', '💪', '👏', '🎉', '😂', '❤️', '😮'] as const

export type ReactionEmoji = (typeof REACTIONS)[number]

export const isReaction = (value: string): value is ReactionEmoji => (REACTIONS as readonly string[]).includes(value)
