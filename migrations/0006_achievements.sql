CREATE TABLE earned_titles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, title_id)
);
CREATE TABLE title_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  FOREIGN KEY (user_id, title_id) REFERENCES earned_titles(user_id, title_id)
);
CREATE TABLE goal_crowns (
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total REAL NOT NULL,
  PRIMARY KEY (goal_id, category)
);
CREATE TABLE crown_records (
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (goal_id, category, user_id)
);

-- Distinct local activity dates, partitioned by goal, prevent duplicate logs
-- and overlapping goals from inflating a streak.
CREATE VIEW eligible_titles AS
WITH days AS (
  SELECT DISTINCT e.goal_id, e.user_id, e.date
  FROM entries e JOIN goals g ON g.id = e.goal_id
  WHERE e.amount > 0 AND e.date BETWEEN g.start_date AND g.end_date
), islands AS (
  SELECT *, julianday(date) - ROW_NUMBER() OVER (PARTITION BY goal_id, user_id ORDER BY date) AS island
  FROM days
), streaks AS (
  SELECT goal_id, user_id, COUNT(*) AS days FROM islands GROUP BY goal_id, user_id, island
), thresholds(title_id, days) AS (
  VALUES ('initiate', 1), ('acolyte', 3), ('disciple', 7), ('veteran', 14), ('legend', 28)
)
SELECT DISTINCT s.goal_id, s.user_id, t.title_id FROM streaks s JOIN thresholds t ON s.days >= t.days;

INSERT OR IGNORE INTO earned_titles (user_id, title_id, earned_at)
SELECT user_id, title_id, unixepoch() * 1000 FROM eligible_titles;

-- Components are free-form today. Recognize common spelling and unit aliases;
-- unrecognized activities still contribute to overall points and active days.
CREATE VIEW crown_totals AS
WITH activity AS (
  SELECT e.*, c.weight,
    lower(replace(replace(replace(trim(c.name), '-', ''), ' ', ''), '_', '')) AS activity,
    lower(trim(c.unit)) AS unit
  FROM entries e JOIN components c ON c.id = e.component_id
  JOIN goals g ON g.id = e.goal_id
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
