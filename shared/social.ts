export const QUICK_REACTIONS = ['👍', '🔥', '💪', '👏', '🎉', '😂', '❤️', '😮'] as const

const REDUNDANT_VARIATION_SELECTOR = /^(\p{Emoji_Presentation})️$/u

export const normalizeReaction = (emoji: string) => emoji.replace(REDUNDANT_VARIATION_SELECTOR, '$1')
