import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { CLEAR_AMOUNTS_SQL, DELETE_EMPTY_ENTRIES_SQL, ENTRY_ACTIVITY_SQL, GOAL_COMPONENT_COUNT_SQL, INSERT_AMOUNTS_SQL } from '../worker/entries'

const MIGRATION = '0014_entry_amounts.sql'
let db: DatabaseSync

const migrate = (include: (file: string) => boolean) => {
  for (const file of readdirSync('migrations').sort().filter(include)) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
}
const amounts = (entry: string) => db.prepare('SELECT component_id, amount FROM entry_amounts WHERE entry_id = ? ORDER BY component_id').all(entry)

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  migrate((file) => file < MIGRATION)
  db.exec(`INSERT INTO users (id, google_sub, email, name, created_at) VALUES ('a', 'a', 'a@example.com', 'a', 0), ('b', 'b', 'b@example.com', 'b', 0);
    INSERT INTO groups VALUES ('g', 'g', 'a', 'UTC', 'invite', 0);
    INSERT INTO memberships (group_id, user_id, joined_at) VALUES ('g', 'a', 0), ('g', 'b', 0);
    INSERT INTO goals (id, group_id, name, start_date, end_date, created_at) VALUES ('go', 'g', 'Goal', '2026-01-01', '2026-12-31', 0);
    INSERT INTO components (id, goal_id, name, unit, target, weight, position) VALUES ('push', 'go', 'Pushups', 'rep', 100, 1, 0), ('run', 'go', 'Running', 'mile', 10, 1, 1);
    INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, note, created_at, occurred_at)
      VALUES ('e1', 'go', 'push', 'a', 20, '2026-06-01', 'Felt good', 1, 2), ('e2', 'go', 'run', 'b', 3, '2026-06-02', NULL, 3, 4);
    INSERT INTO reactions VALUES ('e1', 'b', '🔥', 5);
    INSERT INTO comments VALUES ('c1', 'e1', 'b', 'Nice', 6);
    INSERT INTO photos VALUES ('p1', 'e1', 7), ('p2', NULL, 8);`)
  migrate((file) => file >= MIGRATION)
})
afterEach(() => db.close())

describe('entry amounts', () => {
  it('moves each amount into its own line and keeps reactions, comments and photos', () => {
    expect(db.prepare('SELECT id, user_id, date, note, created_at, occurred_at FROM entries ORDER BY id').all()).toEqual([
      { id: 'e1', user_id: 'a', date: '2026-06-01', note: 'Felt good', created_at: 1, occurred_at: 2 },
      { id: 'e2', user_id: 'b', date: '2026-06-02', note: null, created_at: 3, occurred_at: 4 },
    ])
    expect(amounts('e1')).toEqual([{ component_id: 'push', amount: 20 }])
    expect(amounts('e2')).toEqual([{ component_id: 'run', amount: 3 }])
    expect(db.prepare('SELECT entry_id, emoji FROM reactions').all()).toEqual([{ entry_id: 'e1', emoji: '🔥' }])
    expect(db.prepare('SELECT id, entry_id FROM comments').all()).toEqual([{ id: 'c1', entry_id: 'e1' }])
    expect(db.prepare('SELECT key, entry_id FROM photos ORDER BY key').all()).toEqual([{ key: 'p1', entry_id: 'e1' }, { key: 'p2', entry_id: null }])
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name LIKE '%backup%'").all()).toEqual([])
    db.exec("DELETE FROM entries WHERE id = 'e1'")
    expect(db.prepare('SELECT COUNT(*) AS n FROM reactions').get()?.n).toBe(0)
    expect(db.prepare("SELECT entry_id FROM photos WHERE key = 'p1'").get()?.entry_id).toBeNull()
  })

  it('replaces the lines of an entry and describes them in goal order', () => {
    db.prepare(CLEAR_AMOUNTS_SQL).run('e1')
    db.prepare(INSERT_AMOUNTS_SQL).run('e1', JSON.stringify([{ componentId: 'run', amount: 1.5 }, { componentId: 'push', amount: 30 }]))
    expect(amounts('e1')).toEqual([{ component_id: 'push', amount: 30 }, { component_id: 'run', amount: 1.5 }])
    expect(db.prepare(ENTRY_ACTIVITY_SQL).all('e1').map((r) => r.name)).toEqual(['Pushups', 'Running'])
  })

  it('counts only activities of the goal', () => {
    expect(db.prepare(GOAL_COMPONENT_COUNT_SQL).get('go', JSON.stringify(['push', 'run']))?.n).toBe(2)
    expect(db.prepare(GOAL_COMPONENT_COUNT_SQL).get('go', JSON.stringify(['push', 'other']))?.n).toBe(1)
  })

  it('deletes entries left with no lines when an activity is removed', () => {
    db.prepare(INSERT_AMOUNTS_SQL).run('e1', JSON.stringify([{ componentId: 'run', amount: 2 }]))
    db.exec("DELETE FROM components WHERE id = 'run'")
    db.prepare(DELETE_EMPTY_ENTRIES_SQL).run('go')
    expect(db.prepare('SELECT id FROM entries').all()).toEqual([{ id: 'e1' }])
    expect(amounts('e1')).toEqual([{ component_id: 'push', amount: 20 }])
  })
})
