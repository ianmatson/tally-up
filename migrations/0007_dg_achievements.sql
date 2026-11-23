-- Resolve the existing DG group once, then use its stable ID everywhere.
-- No match or ambiguous names leave achievements disabled for all groups.
CREATE TABLE achievement_groups (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  group_id TEXT NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE
);
INSERT INTO achievement_groups (singleton, group_id)
SELECT 1, id FROM groups WHERE name = 'DG (Daddy Gainz)'
  AND (SELECT COUNT(*) FROM groups WHERE name = 'DG (Daddy Gainz)') = 1;

CREATE TABLE group_earned_titles (
  group_id TEXT NOT NULL REFERENCES achievement_groups(group_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id, title_id)
);
CREATE TABLE group_title_preferences (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title_id TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id, user_id, title_id)
    REFERENCES group_earned_titles(group_id, user_id, title_id) ON DELETE CASCADE
);

DROP VIEW eligible_titles;
DROP VIEW crown_totals;
CREATE VIEW eligible_titles AS
WITH days AS (
  SELECT DISTINCT e.goal_id, e.user_id, e.date
  FROM entries e JOIN goals g ON g.id = e.goal_id
  JOIN achievement_groups ag ON ag.group_id = g.group_id
  WHERE e.amount > 0 AND e.date BETWEEN g.start_date AND g.end_date
), islands AS (
  SELECT *, julianday(date) - ROW_NUMBER() OVER (PARTITION BY goal_id, user_id ORDER BY date) AS island
  FROM days
), streaks AS (
  SELECT goal_id, user_id, COUNT(*) AS days FROM islands GROUP BY goal_id, user_id, island
), thresholds(title_id, days) AS (
  VALUES ('initiate', 1), ('acolyte', 3), ('disciple', 7), ('veteran', 14), ('legend', 28)
)
SELECT DISTINCT g.group_id, s.goal_id, s.user_id, t.title_id FROM streaks s
JOIN goals g ON g.id = s.goal_id JOIN thresholds t ON s.days >= t.days;


CREATE VIEW crown_totals AS
WITH activity AS (
  SELECT e.*, c.weight,
    lower(replace(replace(replace(trim(c.name), '-', ''), ' ', ''), '_', '')) AS activity,
    lower(trim(c.unit)) AS unit
  FROM entries e JOIN components c ON c.id = e.component_id
  JOIN goals g ON g.id = e.goal_id
  JOIN achievement_groups ag ON ag.group_id = g.group_id
  JOIN memberships m ON m.group_id = g.group_id AND m.user_id = e.user_id
  WHERE e.amount > 0 AND e.date BETWEEN g.start_date AND g.end_date
), values_by_user AS (
  SELECT goal_id, user_id, 'points' AS category, SUM(amount * weight) AS total, MIN(created_at) AS first_at FROM activity GROUP BY goal_id, user_id
  UNION ALL
  SELECT goal_id, user_id, 'days', COUNT(DISTINCT date), MIN(created_at) FROM activity GROUP BY goal_id, user_id
  UNION ALL
  SELECT goal_id, user_id,
    CASE WHEN activity IN ('pushup', 'pushups') THEN 'pushups'
         WHEN activity IN ('squat', 'squats') THEN 'squats' ELSE 'situps' END,
    SUM(amount), MIN(created_at) FROM activity
    WHERE activity IN ('pushup', 'pushups', 'squat', 'squats', 'situp', 'situps')
      AND unit IN ('rep', 'reps', 'repetition', 'repetitions', 'pushup', 'pushups', 'push-up', 'push-ups', 'squat', 'squats', 'situp', 'situps', 'sit-up', 'sit-ups')
    GROUP BY goal_id, user_id, 3
  UNION ALL
  SELECT goal_id, user_id, 'mileage',
    SUM(amount * CASE WHEN unit IN ('km', 'kilometer', 'kilometers', 'kilometre', 'kilometres') THEN 0.621371192237334
      WHEN unit IN ('m', 'meter', 'meters', 'metre', 'metres') THEN 0.000621371192237334 ELSE 1 END), MIN(created_at)
    FROM activity WHERE unit IN ('mi', 'mile', 'miles', 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'm', 'meter', 'meters', 'metre', 'metres')
    GROUP BY goal_id, user_id
)
SELECT goal_id, user_id, category, ROUND(total, 8) AS total, first_at FROM values_by_user WHERE total > 0;

-- The initial feature was account-wide. Only carry over titles supported by
-- DG activity, never achievements from a different group.
INSERT INTO group_earned_titles (group_id, user_id, title_id, earned_at)
SELECT DISTINCT e.group_id, e.user_id, e.title_id, COALESCE(t.earned_at, unixepoch() * 1000)
FROM eligible_titles e LEFT JOIN earned_titles t ON t.user_id = e.user_id AND t.title_id = e.title_id;
INSERT INTO group_title_preferences (group_id, user_id, title_id)
SELECT e.group_id, p.user_id, p.title_id FROM title_preferences p
JOIN group_earned_titles e ON e.user_id = p.user_id AND e.title_id = p.title_id;
-- Keep the legacy tables readable during the migration-before-code rollout.
-- New code never uses them. Remove awards unsupported by DG activity.
DELETE FROM title_preferences WHERE NOT EXISTS (
  SELECT 1 FROM group_earned_titles e WHERE e.user_id = title_preferences.user_id AND e.title_id = title_preferences.title_id
);
DELETE FROM earned_titles WHERE NOT EXISTS (
  SELECT 1 FROM group_earned_titles e WHERE e.user_id = earned_titles.user_id AND e.title_id = earned_titles.title_id
);

DELETE FROM goal_crowns WHERE goal_id NOT IN
  (SELECT id FROM goals WHERE group_id IN (SELECT group_id FROM achievement_groups));
DELETE FROM crown_records WHERE goal_id NOT IN
  (SELECT id FROM goals WHERE group_id IN (SELECT group_id FROM achievement_groups));
