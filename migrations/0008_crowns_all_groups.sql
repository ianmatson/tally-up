DROP VIEW crown_totals;
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
