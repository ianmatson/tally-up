import { TITLES } from '../shared/achievements'

const TITLE_THRESHOLDS = TITLES.map((t) => `('${t.id}', ${t.days})`).join(', ')

export const ACHIEVEMENT_SQL = [
    `INSERT OR IGNORE INTO group_earned_titles (group_id, user_id, title_id, earned_at)
      WITH days AS (
        SELECT DISTINCT g.group_id, e.user_id, e.date
        FROM entries e JOIN goals g ON g.id = e.goal_id
        JOIN achievement_groups ag ON ag.group_id = g.group_id
        WHERE e.goal_id = ?1 AND e.amount > 0 AND e.date BETWEEN g.start_date AND g.end_date
      ), streaks AS (
        SELECT group_id, user_id, COUNT(*) AS days FROM (
          SELECT group_id, user_id, julianday(date) - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date) AS island FROM days
        ) GROUP BY group_id, user_id, island
      ), thresholds(title_id, days) AS (VALUES ${TITLE_THRESHOLDS})
      SELECT DISTINCT s.group_id, s.user_id, t.title_id, unixepoch() * 1000 FROM streaks s JOIN thresholds t ON s.days >= t.days`,
]

export function achievementStatements(db: D1Database, goalId: string) {
  return ACHIEVEMENT_SQL.map((sql) => db.prepare(sql).bind(goalId))
}

/** A title is readable/equippable only in the enabled group, by a member. */
export const GROUP_TITLES_SQL = `SELECT user_id AS userId, title_id AS titleId, earned_at AS earnedAt
  FROM group_earned_titles WHERE group_id = ?1
    AND group_id IN (SELECT group_id FROM achievement_groups)
    AND user_id IN (SELECT user_id FROM memberships WHERE group_id = ?1)`

export const EQUIP_TITLE_SQL = `INSERT INTO group_title_preferences (group_id, user_id, title_id)
  SELECT t.group_id, t.user_id, t.title_id FROM group_earned_titles t
  JOIN achievement_groups a ON a.group_id = t.group_id
  JOIN memberships m ON m.group_id = t.group_id AND m.user_id = t.user_id
  WHERE t.group_id = ?1 AND t.user_id = ?2 AND t.title_id = ?3
  ON CONFLICT (group_id, user_id) DO UPDATE SET title_id = excluded.title_id`
