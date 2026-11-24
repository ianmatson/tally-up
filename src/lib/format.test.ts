import { describe, expect, it } from 'vitest'
import type { Member } from '$shared/api'
import { formatNumberDown, memberLabel } from './format'

const member = (id: string, name: string): Member => ({ id, name, avatarUrl: null, joinedAt: 0 })

describe('memberLabel', () => {
  it('uses first names, adds a last initial only when first names collide, and says You for the viewer', () => {
    const members = new Map([member('a', 'Tariq Haddad'), member('b', 'Tariq Mbeki'), member('c', 'Jo Silva'), member('d', 'Cher')].map((m) => [m.id, m]))
    expect(memberLabel(members, 'a', 'z')).toBe('Tariq H.')
    expect(memberLabel(members, 'b', 'z')).toBe('Tariq M.')
    expect(memberLabel(members, 'c', 'z')).toBe('Jo')
    expect(memberLabel(members, 'd', 'z')).toBe('Cher')
    expect(memberLabel(members, 'c', 'c')).toBe('You')
    expect(memberLabel(members, 'gone', 'z')).toBe('Former member')
  })
})

describe('formatNumberDown', () => {
  it('never rounds an amount up to a target it has not reached', () => {
    expect([1.06, 2.3, 0.7, 234.6, 99.99].map(formatNumberDown)).toEqual(['1', '2.3', '0.7', '234', '99.9'])
  })
})
