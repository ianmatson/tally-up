ALTER TABLE entries ADD COLUMN occurred_at INTEGER NOT NULL DEFAULT 0;

UPDATE entries
SET occurred_at = CASE
  WHEN date(created_at / 1000, 'unixepoch') = date THEN created_at
  ELSE CAST(strftime('%s', date || ' 12:00:00') AS INTEGER) * 1000
END;
