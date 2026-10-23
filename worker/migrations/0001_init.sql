-- Users + check history + per-user daily AI quota + per-IP registration counter.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw TEXT NOT NULL,               -- pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  summary TEXT NOT NULL,          -- JSON: title, description (truncated), country, platform, category, image_count, risk. Never images.
  result TEXT NOT NULL            -- JSON: AI result (notes, features, image facts, ...)
);
CREATE INDEX IF NOT EXISTS idx_checks_user ON checks(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,              -- UTC YYYY-MM-DD
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS reg_ip (
  ip_hash TEXT NOT NULL,          -- HMAC(ip, JWT_SECRET); raw IPs are never stored
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);
