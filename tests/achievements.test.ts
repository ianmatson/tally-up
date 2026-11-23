import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { ACHIEVEMENT_SQL } from '../worker/achievements'
import { addDays } from '../shared/dates'
import { currentStreak } from '../shared/achievements'

let db: DatabaseSync
let sequence = 0
const refresh = (goal = 'goal') => {
  db.exec('BEGIN')
  try { for (const sql of ACHIEVEMENT_SQL) db.prepare(sql).run(goal); db.exec('COMMIT') }
  catch (error) { db.exec('ROLLBACK'); throw error }
}
const titles = (user = 'a') => db.prepare('SELECT title_id FROM earned_titles WHERE user_id = ? ORDER BY title_id').all(user).map((r) => r.title_id)
const crown = (category = 'pushups') => db.prepare('SELECT user_id, total FROM goal_crowns WHERE goal_id = ? AND category = ?').get('goal', category)
function log(user = 'a', amount = 10, date = '2026-11-23', component = 'push', goal = 'goal') {
  const id = `entry-${++sequence}`
  db.prepare('INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, created_at, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, goal, component, user, amount, date, sequence, Date.parse(date))
  refresh(goal)
  return id
}
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const file of readdirSync('migrations').sort()) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
  for (const user of ['a', 'b', 'c']) db.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, 0)').run(user, user, `${user}@example.com`, user)
  db.exec(`INSERT INTO groups VALUES ('group', 'Group', 'a', 'America/Chicago', 'invite', 0);
    INSERT INTO memberships VALUES ('group', 'a', 0), ('group', 'b', 0), ('group', 'c', 0);
    INSERT INTO goals VALUES ('goal', 'group', 'Goal', '2026-11-23', '2026-12-31', NULL, 0);
    INSERT INTO components VALUES ('push', 'goal', 'Push-ups', 'reps', 1000, 2, 0),
      ('run', 'goal', 'Running', 'miles', 100, 10, 1), ('km', 'goal', 'Running', 'km', 100, 6, 2),
      ('squat', 'goal', 'Squats', 'reps', 1000, 1, 3), ('sit', 'goal', 'Sit ups', 'reps', 1000, 1, 4);`)
})
afterEach(() => db.close())

describe('permanent titles', () => {
  it('unlocks exact streak milestones, ignores duplicate days, and keeps titles after deletion', () => {
    log(); log()
    expect(titles()).toEqual(['initiate'])
    for (let day = 1; day < 28; day++) {
      log('a', 10, addDays('2026-11-23', day))
      if (day === 2) expect(titles()).toEqual(['acolyte', 'initiate'])
      if (day === 6) expect(titles()).toContain('disciple')
      if (day === 13) expect(titles()).toContain('veteran')
      if (day === 26) expect(titles()).not.toContain('legend')
    }
    expect(titles()).toEqual(['acolyte', 'disciple', 'initiate', 'legend', 'veteran'])
    db.exec('DELETE FROM entries'); refresh()
    expect(titles()).toContain('legend')
    expect(crown()).toBeUndefined()
  })
  it('does not combine broken streaks or different goals', () => {
    log('a', 10, '2026-11-23'); log('a', 10, '2026-11-24'); log('a', 10, '2026-11-26')
    db.exec(`INSERT INTO goals VALUES ('other', 'group', 'Other', '2026-11-23', '2026-12-31', NULL, 1);
      INSERT INTO components VALUES ('other-push', 'other', 'Pushups', 'reps', 100, 1, 0)`)
    log('a', 10, '2026-11-25', 'other-push', 'other')
    expect(titles()).toEqual(['initiate'])
  })
  it('recognizes backdated entries completing a streak', () => {
    log('a', 10, '2026-11-23'); log('a', 10, '2026-11-25'); log('a', 10, '2026-11-24')
    expect(titles()).toContain('acolyte')
  })
  it('backfills existing activity when applying the migration', () => {
    const migration = readFileSync('migrations/0006_achievements.sql', 'utf8')
    db.exec('DROP VIEW eligible_titles; DROP VIEW crown_totals; DROP TABLE title_preferences; DROP TABLE earned_titles; DROP TABLE goal_crowns; DROP TABLE crown_records;')
    for (let i = 0; i < 7; i++) db.prepare("INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, created_at, occurred_at) VALUES (?, 'goal', 'push', 'a', 10, ?, 0, 0)").run(`old-${i}`, addDays('2026-11-23', i))
    db.exec(migration)
    expect(titles()).toEqual(['acolyte', 'disciple', 'initiate'])
  })
  it('only allows earned titles to be equipped via the database constraint', () => {
    log()
    expect(() => db.exec("INSERT INTO title_preferences VALUES ('a', 'legend')")).toThrow()
    db.exec("INSERT INTO title_preferences VALUES ('a', 'initiate')")
  })
})

describe('crowns', () => {
  it('retains the incumbent on ties, transfers on overtake, and preserves prior wins', () => {
    log('b', 10); log('a', 10)
    expect(crown()?.user_id).toBe('b')
    const winning = log('a', 1)
    expect(crown()?.user_id).toBe('a')
    db.prepare('DELETE FROM entries WHERE id = ?').run(winning); refresh()
    expect(crown()?.user_id).toBe('a')
    log('b', 1)
    expect(crown()?.user_id).toBe('b')
    expect(db.prepare("SELECT COUNT(*) AS n FROM crown_records WHERE category = 'pushups'").get()?.n).toBe(2)
  })
  it('uses weighted points, distinct days, and all six crown categories', () => {
    log('a', 10); log('a', 10); log('a', 2, '2026-11-23', 'run');
    log('a', 3, '2026-11-24', 'squat'); log('a', 4, '2026-11-24', 'sit')
    expect(crown('points')?.total).toBe(67)
    expect(crown('days')?.total).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS n FROM goal_crowns').get()?.n).toBe(6)
  })
  it('normalizes kilometers to miles and respects edits and membership removal', () => {
    log('a', 1, '2026-11-23', 'run')
    const id = log('b', 1.609344, '2026-11-23', 'km')
    expect(crown('mileage')).toEqual({ user_id: 'a', total: 1 })
    db.prepare('UPDATE entries SET amount = 4 WHERE id = ?').run(id); refresh()
    expect(crown('mileage')?.user_id).toBe('b')
    db.exec("DELETE FROM memberships WHERE user_id = 'b'"); refresh()
    expect(crown('mileage')?.user_id).toBe('a')
  })
  it('excludes entries outside the goal window and activities measured in time from rep crowns', () => {
    log('a', 10, '2026-11-22')
    expect(crown()).toBeUndefined()
    expect(titles()).toEqual([])
    db.exec("UPDATE components SET unit = 'min' WHERE id = 'push'")
    log()
    expect(crown()).toBeUndefined()
    expect(crown('points')?.total).toBe(20)
  })
})

it('current streak uses calendar dates, preserves yesterday, and resets after a missed day', () => {
  const dates = ['2026-11-23', '2026-11-24', '2026-11-24', '2026-11-25']
  expect(currentStreak(dates, '2026-11-25')).toBe(3)
  expect(currentStreak(dates, '2026-11-26')).toBe(3)
  expect(currentStreak(dates, '2026-11-27')).toBe(0)
  expect(currentStreak(['2026-12-31', '2027-01-01'], '2027-01-01')).toBe(2)
})
