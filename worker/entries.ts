export const INSERT_AMOUNTS_SQL = `INSERT INTO entry_amounts (entry_id, component_id, amount)
  SELECT ?, json_extract(value, '$.componentId'), json_extract(value, '$.amount') FROM json_each(?)`
export const CLEAR_AMOUNTS_SQL = 'DELETE FROM entry_amounts WHERE entry_id = ?'
export const GOAL_COMPONENT_COUNT_SQL = 'SELECT COUNT(*) AS n FROM components WHERE goal_id = ? AND id IN (SELECT value FROM json_each(?))'
export const DELETE_EMPTY_ENTRIES_SQL = 'DELETE FROM entries WHERE goal_id = ? AND NOT EXISTS (SELECT 1 FROM entry_amounts a WHERE a.entry_id = entries.id)'
export const ENTRY_ACTIVITY_SQL = `SELECT a.amount, c.unit, c.name FROM entry_amounts a
  JOIN components c ON c.id = a.component_id WHERE a.entry_id = ? ORDER BY c.position`
