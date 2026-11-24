import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { DELETE_PHOTOS_SQL, DETACH_PHOTO_SQL, EXPIRED_PHOTOS_SQL, INSERT_PHOTO_SQL, MEMBER_PHOTO_SQL, PHOTO_LIFETIME_MS } from '../worker/photos'

const NOW = 1_800_000_000_000
let db: DatabaseSync

const attach = (key: string, entry: string, at = NOW) => {
  db.exec('BEGIN')
  db.prepare(DETACH_PHOTO_SQL).run(entry)
  db.prepare(INSERT_PHOTO_SQL).run(key, entry, at)
  db.exec('COMMIT')
}
const expired = () => db.prepare(EXPIRED_PHOTOS_SQL).all(NOW - PHOTO_LIFETIME_MS).map((r) => r.key)
const canSee = (user: string, key: string) => !!db.prepare(MEMBER_PHOTO_SQL).get(user, key)

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
  for (const user of ['a', 'b']) db.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, 0)').run(user, user, `${user}@example.com`, user)
  db.prepare("INSERT INTO groups VALUES ('g', 'g', 'a', 'UTC', 'invite', 0)").run()
  db.prepare("INSERT INTO memberships (group_id, user_id, joined_at) VALUES ('g', 'a', 0)").run()
  db.prepare("INSERT INTO goals (id, group_id, name, start_date, end_date, created_at) VALUES ('go', 'g', 'Goal', '2026-01-01', '2026-12-31', 0)").run()
  db.prepare("INSERT INTO components (id, goal_id, name, unit, target, weight, position) VALUES ('c', 'go', 'Run', 'mi', 10, 1, 0)").run()
  for (const entry of ['e1', 'e2'])
    db.prepare("INSERT INTO entries (id, goal_id, user_id, date, note, created_at) VALUES (?, 'go', 'a', '2026-06-01', NULL, 0)").run(entry)
})
afterEach(() => db.close())

describe('entry photos', () => {
  it('shows a photo only to members of its group', () => {
    attach('p1', 'e1')
    expect(canSee('a', 'p1')).toBe(true)
    expect(canSee('b', 'p1')).toBe(false)
  })

  it('releases the old photo when an entry gets a new one', () => {
    attach('p1', 'e1')
    attach('p2', 'e1')
    expect(expired()).toEqual(['p1'])
    expect(canSee('a', 'p1')).toBe(false)
  })

  it('releases photos that are removed or whose entry is deleted', () => {
    attach('p1', 'e1')
    attach('p2', 'e2')
    db.prepare(DETACH_PHOTO_SQL).run('e1')
    db.prepare("DELETE FROM entries WHERE id = 'e2'").run()
    expect(expired().sort()).toEqual(['p1', 'p2'])
  })

  it('expires photos after their lifetime', () => {
    attach('old', 'e1', NOW - PHOTO_LIFETIME_MS - 1)
    attach('new', 'e2', NOW - PHOTO_LIFETIME_MS + 1)
    expect(expired()).toEqual(['old'])
    db.prepare(DELETE_PHOTOS_SQL).run(JSON.stringify(['old']))
    expect(db.prepare('SELECT key FROM photos').all().map((r) => r.key)).toEqual(['new'])
  })
})
