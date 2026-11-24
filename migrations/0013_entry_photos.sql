CREATE TABLE photos (
  key TEXT PRIMARY KEY,
  entry_id TEXT UNIQUE REFERENCES entries(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX photos_created ON photos(created_at);
