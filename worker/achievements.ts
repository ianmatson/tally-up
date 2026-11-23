/** These statements run in the same D1 batch as the activity mutation.
 * Ranking and incumbent tie-breaking happen in SQL against current DB state,
 * rather than a read/compute/write cycle that could overwrite concurrent logs.
 */
export const ACHIEVEMENT_SQL = [
    `INSERT OR IGNORE INTO earned_titles (user_id, title_id, earned_at)
      SELECT user_id, title_id, unixepoch() * 1000 FROM eligible_titles WHERE goal_id = ?1`,
    `INSERT INTO goal_crowns (goal_id, category, user_id, total)
      SELECT goal_id, category, user_id, total FROM (
        SELECT t.*, ROW_NUMBER() OVER (PARTITION BY t.category ORDER BY t.total DESC,
          CASE WHEN t.user_id = c.user_id THEN 0 ELSE 1 END, t.first_at, t.user_id) AS rank
        FROM crown_totals t LEFT JOIN goal_crowns c ON c.goal_id = t.goal_id AND c.category = t.category
        WHERE t.goal_id = ?1
      ) WHERE rank = 1
      ON CONFLICT (goal_id, category) DO UPDATE SET user_id = excluded.user_id, total = excluded.total`,
    `DELETE FROM goal_crowns WHERE goal_id = ?1 AND category NOT IN
      (SELECT category FROM crown_totals WHERE goal_id = ?1)`,
    `INSERT OR IGNORE INTO crown_records (goal_id, category, user_id, earned_at)
      SELECT goal_id, category, user_id, unixepoch() * 1000 FROM goal_crowns WHERE goal_id = ?1`,
]

export function achievementStatements(db: D1Database, goalId: string) {
  return ACHIEVEMENT_SQL.map((sql) => db.prepare(sql).bind(goalId))
}
