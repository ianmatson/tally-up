import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { ACHIEVEMENT_SQL, EQUIP_TITLE_SQL, GROUP_TITLES_SQL } from '../worker/achievements'
import { addDays } from '../shared/dates'
import { currentStreak } from '../shared/achievements'

let db: DatabaseSync
let sequence = 0
const refresh = (goal = 'goal') => {
  db.exec('BEGIN')
  try { for (const sql of ACHIEVEMENT_SQL) db.prepare(sql).run(goal); db.exec('COMMIT') }
  catch (error) { db.exec('ROLLBACK'); throw error }
}
const titles = (user = 'a') => db.prepare('SELECT title_id FROM group_earned_titles WHERE user_id = ? ORDER BY title_id').all(user).map((r) => r.title_id)
function log(user = 'a', amount = 10, date = '2026-11-23', component = 'push', goal = 'goal') {
  const id = `entry-${++sequence}`
  db.prepare('INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, created_at, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, goal, component, user, amount, date, sequence, Date.parse(date))
  refresh(goal)
  return id
}
const migrateFrom = (version: string) => {
  for (const file of readdirSync('migrations').sort().filter((f) => f >= version)) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
}
function setup(scoped = true) {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  for (const file of readdirSync('migrations').sort().filter((f) => f < '0007')) db.exec(readFileSync(`migrations/${file}`, 'utf8'))
  for (const user of ['a', 'b', 'c']) db.prepare('INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?, ?, ?, ?, 0)').run(user, user, `${user}@example.com`, user)
  db.exec(`INSERT INTO groups VALUES ('group', 'DG (Daddy Gainz)', 'a', 'America/Chicago', 'invite', 0);
    INSERT INTO memberships VALUES ('group', 'a', 0), ('group', 'b', 0), ('group', 'c', 0);
    INSERT INTO goals VALUES ('goal', 'group', 'Goal', '2026-11-23', '2026-12-31', NULL, 0);
    INSERT INTO components VALUES ('push', 'goal', 'Push-ups', 'reps', 1000, 2, 0),
      ('run', 'goal', 'Running', 'miles', 100, 10, 1), ('km', 'goal', 'Running', 'km', 100, 6, 2),
      ('squat', 'goal', 'Squats', 'reps', 1000, 1, 3), ('sit', 'goal', 'Sit ups', 'reps', 1000, 1, 4);`)
  if (scoped) migrateFrom('0007')
}
beforeEach(() => setup())
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
  })
  it('ignores entries outside the goal window', () => {
    log('a', 10, '2026-11-22')
    expect(titles()).toEqual([])
  })
  it('does not combine broken streaks or different goals', () => {
    log('a', 10, '2026-11-23'); log('a', 10, '2026-11-24'); log('a', 10, '2026-11-26')
    db.exec(`INSERT INTO goals VALUES ('other', 'group', 'Other', '2026-11-23', '2026-12-31', NULL, 1);
      INSERT INTO components (id, goal_id, name, unit, target, weight, position) VALUES ('other-push', 'other', 'Pushups', 'reps', 100, 1, 0)`)
    log('a', 10, '2026-11-25', 'other-push', 'other')
    expect(titles()).toEqual(['initiate'])
  })
  it('recognizes backdated entries completing a streak', () => {
    log('a', 10, '2026-11-23'); log('a', 10, '2026-11-25'); log('a', 10, '2026-11-24')
    expect(titles()).toContain('acolyte')
  })
  it('backfills existing activity when applying the migration', () => {
    db.close(); setup(false)
    const migration = readFileSync('migrations/0007_dg_achievements.sql', 'utf8')
    for (let i = 0; i < 7; i++) db.prepare("INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, created_at, occurred_at) VALUES (?, 'goal', 'push', 'a', 10, ?, 0, 0)").run(`old-${i}`, addDays('2026-11-23', i))
    db.exec(migration)
    expect(titles()).toEqual(['acolyte', 'disciple', 'initiate'])
  })
  it('only allows earned titles to be equipped via the database constraint', () => {
    log()
    expect(() => db.exec("INSERT INTO group_title_preferences VALUES ('group', 'a', 'legend')")).toThrow()
    db.exec("INSERT INTO group_title_preferences VALUES ('group', 'a', 'initiate')")
  })
})

it('current streak uses calendar dates, preserves yesterday, and resets after a missed day', () => {
  const dates = ['2026-11-23', '2026-11-24', '2026-11-24', '2026-11-25']
  expect(currentStreak(dates, '2026-11-25')).toBe(3)
  expect(currentStreak(dates, '2026-11-26')).toBe(3)
  expect(currentStreak(dates, '2026-11-27')).toBe(0)
  expect(currentStreak(['2026-12-31', '2027-01-01'], '2027-01-01')).toBe(2)
})


function otherGroup(name = 'Another group') {
  db.prepare("INSERT INTO groups VALUES ('outside', ?, 'a', 'America/Chicago', 'outside-invite', 0)").run(name)
  db.exec(`INSERT INTO memberships VALUES ('outside', 'a', 0);
    INSERT INTO goals VALUES ('outside-goal', 'outside', 'Other goal', '2026-11-23', '2026-12-31', NULL, 0);
    INSERT INTO components (id, goal_id, name, unit, target, weight, position) VALUES ('outside-push', 'outside-goal', 'Pushups', 'reps', 100, 1, 0);`)
}

describe('DG-only titles', () => {
  it('ignores other groups for titles', () => {
    otherGroup()
    for (let i = 0; i < 28; i++) log('a', 1000, addDays('2026-11-23', i), 'outside-push', 'outside-goal')
    expect(titles()).toEqual([])
    log('a', 10)
    expect(titles()).toEqual(['initiate'])
    expect(db.prepare(GROUP_TITLES_SQL).all('outside')).toEqual([])
    expect(db.prepare(GROUP_TITLES_SQL).all('group')).toHaveLength(1)
    expect(db.prepare(EQUIP_TITLE_SQL).run('outside', 'a', 'initiate').changes).toBe(0)
    expect(db.prepare(EQUIP_TITLE_SQL).run('group', 'a', 'initiate').changes).toBe(1)
    db.exec("DELETE FROM memberships WHERE group_id = 'group' AND user_id = 'a'")
    expect(db.prepare(EQUIP_TITLE_SQL).run('group', 'a', 'initiate').changes).toBe(0)
  })
  it('keeps the restriction on the original group ID through renames and duplicate names', () => {
    db.exec("UPDATE groups SET name = 'Renamed DG' WHERE id = 'group'")
    otherGroup('DG (Daddy Gainz)')
    log('a', 100, '2026-11-23', 'outside-push', 'outside-goal')
    expect(titles()).toEqual([])
    log()
    expect(titles()).toEqual(['initiate'])
    expect(db.prepare('SELECT group_id FROM achievement_groups').get()?.group_id).toBe('group')
  })
  it.each(['missing', 'ambiguous'])('disables titles if the initial DG match is %s', (scenario) => {
    db.close(); setup(false)
    if (scenario === 'missing') db.exec("UPDATE groups SET name = 'Not DG'")
    else otherGroup('DG (Daddy Gainz)')
    migrateFrom('0007')
    log()
    expect(db.prepare('SELECT * FROM achievement_groups').all()).toEqual([])
    expect(titles()).toEqual([])
  })
  it('cleans up account-wide awards from outside DG during migration', () => {
    db.close(); setup(false)
    otherGroup()
    db.exec(`INSERT INTO entries (id, goal_id, component_id, user_id, amount, date, created_at, occurred_at)
        VALUES ('old-dg', 'goal', 'push', 'a', 10, '2026-11-23', 0, 0);
      INSERT INTO earned_titles VALUES ('a', 'initiate', 100), ('a', 'legend', 200);
      INSERT INTO title_preferences VALUES ('a', 'legend');
      INSERT INTO goal_crowns VALUES ('outside-goal', 'pushups', 'a', 1000);
      INSERT INTO crown_records VALUES ('outside-goal', 'pushups', 'a', 100);`)
    db.exec(readFileSync('migrations/0007_dg_achievements.sql', 'utf8'))
    expect(titles()).toEqual(['initiate'])
    expect(db.prepare('SELECT * FROM group_title_preferences').all()).toEqual([])
    expect(db.prepare('SELECT * FROM goal_crowns').all()).toEqual([])
    expect(db.prepare('SELECT * FROM crown_records').all()).toEqual([])
    expect(db.prepare('SELECT earned_at FROM group_earned_titles').get()?.earned_at).toBe(100)
  })
})

it('backfills weekly personal goals for running in miles only', () => {
  expect(db.prepare('SELECT id, period FROM components ORDER BY id').all())
    .toEqual([{ id: 'km', period: 'day' }, { id: 'push', period: 'day' }, { id: 'run', period: 'week' }, { id: 'sit', period: 'day' }, { id: 'squat', period: 'day' }])
})
