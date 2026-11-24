CREATE TABLE goal_point_totals AS
  SELECT goal_id, SUM(target * weight) AS points FROM components GROUP BY goal_id;
UPDATE components SET weight = MAX(0.01, ROUND(100.0 * target * weight /
  (SELECT points FROM goal_point_totals t WHERE t.goal_id = components.goal_id), 2));
DROP TABLE goal_point_totals;
