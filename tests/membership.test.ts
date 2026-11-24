import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { handOverSql, OWNER_TO_ACTOR_SQL, removeMemberSql, SET_ROLE_SQL } from '../worker/membership'

let db: DatabaseSync

function addGroup(id: string, owner: string, members: string[]) {
  db.prepare("INSERT INTO groups VALUES (?, ?, ?, 'UTC', ?, 0)").run(id, id, owner, `invite-${id}`)
  members.forEach((user, i) => db.prepare('INSERT INTO memberships (group_id, user_id, joined_at) VALUES (?, ?, ?)').run(id, user, i))
}
const run = (statements: string[], ...params: string[]) => {
  db.exec('BEGIN')
  for (const sql of statements) db.prepare(sql).run(...params)
  db.exec('COMMIT')
}
const leave = (user: string, group: string) => run([...handOverSql('group'), ...removeMemberSql('self')], user, group)
const removeBy = (actor: string, member: string, group: string) => run([OWNER_TO_ACTOR_SQL, ...removeMemberSql('admin')], member, group, actor)
const deleteAccount = (user: string) => run([...handOverSql('account'), 'DELETE FROM users WHERE id = ?1'], user)
const roles = (group: string) =>
  Object.fromEntries(db.prepare('SELECT user_id, role FROM memberships WHERE group_id = ? ORDER BY joined_at').all(group).map((r) => [r.user_id, r.role]))
const owner = (group: string) => db.prepare('SELECT owner_id FROM groups WHERE id = ?').get(group)?.owner_id

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
  for (const user of ['a', 'b', 'c']) db.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, 0)').run(user, user, `${user}@example.com`, user)
})
afterEach(() => db.close())

describe('group admins', () => {
  it('makes the group creator an admin and everyone else a member', () => {
    addGroup('g', 'a', ['a', 'b'])
    expect(roles('g')).toEqual({ a: 'admin', b: 'member' })
  })

  it('promotes the longest-standing member when the only admin leaves', () => {
    addGroup('g', 'a', ['a', 'b', 'c'])
    leave('a', 'g')
    expect(roles('g')).toEqual({ b: 'admin', c: 'member' })
    expect(owner('g')).toBe('b')
  })

  it('promotes no one when another admin remains', () => {
    addGroup('g', 'a', ['a', 'b', 'c'])
    db.exec("UPDATE memberships SET role = 'admin' WHERE user_id = 'c'")
    leave('a', 'g')
    expect(roles('g')).toEqual({ b: 'member', c: 'admin' })
    expect(owner('g')).toBe('c')
  })

  it('deletes the group when its last member leaves', () => {
    addGroup('g', 'a', ['a'])
    leave('a', 'g')
    expect(db.prepare('SELECT COUNT(*) AS n FROM groups').get()?.n).toBe(0)
  })

  it('hands over or deletes every group when an account is deleted', () => {
    addGroup('shared', 'a', ['a', 'b'])
    addGroup('solo', 'a', ['a'])
    addGroup('theirs', 'b', ['b', 'a'])
    deleteAccount('a')
    expect(roles('shared')).toEqual({ b: 'admin' })
    expect(owner('shared')).toBe('b')
    expect(roles('theirs')).toEqual({ b: 'admin' })
    expect(db.prepare('SELECT id FROM groups ORDER BY id').all().map((r) => r.id)).toEqual(['shared', 'theirs'])
  })

  it('refuses any change that would leave a group without an admin', () => {
    addGroup('g', 'a', ['a', 'b'])
    expect(() => db.exec("UPDATE memberships SET role = 'member' WHERE user_id = 'a'")).toThrow('A group needs at least one admin')
    expect(() => run(removeMemberSql('self'), 'a', 'g')).toThrow('A group needs at least one admin')
    db.exec('ROLLBACK')
    expect(roles('g')).toEqual({ a: 'admin', b: 'member' })
  })

  it('makes a new owner an admin, as the previous release did on account deletion', () => {
    addGroup('g', 'a', ['a', 'b'])
    db.exec("UPDATE groups SET owner_id = 'b'")
    expect(roles('g')).toEqual({ a: 'admin', b: 'admin' })
  })

  it('still deletes a whole group with several members', () => {
    addGroup('g', 'a', ['a', 'b', 'c'])
    db.exec("DELETE FROM groups WHERE id = 'g'")
    expect(db.prepare('SELECT COUNT(*) AS n FROM memberships').get()?.n).toBe(0)
  })

  it('ignores removals and role changes from someone who is no longer an admin', () => {
    addGroup('g', 'a', ['a', 'b', 'c'])
    db.exec("UPDATE memberships SET role = 'admin' WHERE user_id = 'b'")
    removeBy('a', 'b', 'g')
    removeBy('b', 'a', 'g')
    run([SET_ROLE_SQL], 'c', 'g', 'b', 'admin')
    expect(roles('g')).toEqual({ a: 'admin', c: 'member' })
    expect(owner('g')).toBe('a')
  })
})
