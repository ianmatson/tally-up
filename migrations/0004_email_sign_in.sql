CREATE TABLE login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE avatars (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  image BLOB NOT NULL
);

CREATE INDEX users_email ON users (lower(email));
