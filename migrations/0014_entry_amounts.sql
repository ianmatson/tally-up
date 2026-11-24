PRAGMA defer_foreign_keys = true;

CREATE TABLE entry_amounts_backup AS SELECT id AS entry_id, component_id, amount FROM entries;
CREATE TABLE reactions_backup AS SELECT * FROM reactions;
CREATE TABLE comments_backup AS SELECT * FROM comments;
CREATE TABLE photos_backup AS SELECT key, entry_id FROM photos;

CREATE TABLE entries_new (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO entries_new (id, goal_id, user_id, date, note, created_at, occurred_at)
  SELECT id, goal_id, user_id, date, note, created_at, occurred_at FROM entries;
DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;
CREATE INDEX entries_goal ON entries(goal_id);

CREATE TABLE entry_amounts (
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  PRIMARY KEY (entry_id, component_id)
);
CREATE INDEX entry_amounts_component ON entry_amounts(component_id);
INSERT INTO entry_amounts (entry_id, component_id, amount) SELECT entry_id, component_id, amount FROM entry_amounts_backup;

INSERT OR IGNORE INTO reactions SELECT * FROM reactions_backup;
INSERT OR IGNORE INTO comments SELECT * FROM comments_backup;
UPDATE photos SET entry_id = (SELECT b.entry_id FROM photos_backup b WHERE b.key = photos.key);

DROP TABLE entry_amounts_backup;
DROP TABLE reactions_backup;
DROP TABLE comments_backup;
DROP TABLE photos_backup;
