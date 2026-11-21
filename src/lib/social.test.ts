import { describe, expect, it } from 'vitest'
import { withReaction } from './social'

describe('withReaction', () => {
  it('adds a new emoji, joins an existing one, and drops empty ones on removal', () => {
    const added = withReaction([], '🔥', 'a', true)
    expect(added).toEqual([{ emoji: '🔥', userIds: ['a'] }])
    const joined = withReaction(added, '🔥', 'b', true)
    expect(joined).toEqual([{ emoji: '🔥', userIds: ['a', 'b'] }])
    expect(withReaction(joined, '🔥', 'b', true)).toEqual(joined)
    expect(withReaction(joined, '🔥', 'a', false)).toEqual([{ emoji: '🔥', userIds: ['b'] }])
    expect(withReaction([{ emoji: '🔥', userIds: ['a'] }], '🔥', 'a', false)).toEqual([])
  })
})
