-- Email verification codes (register / password reset) + per-email / per-IP send counters.
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL,            -- register | reset
  code_hash TEXT NOT NULL,          -- HMAC(JWT_SECRET, purpose|email|code); the code itself is never stored
  expires_at INTEGER NOT NULL,      -- ms epoch, 10 minutes after sending
  attempts INTEGER NOT NULL DEFAULT 0, -- wrong guesses; the code is dead at 5
  last_sent_at INTEGER NOT NULL,    -- resend cooldown (60 s)
  PRIMARY KEY (email, purpose)
);
CREATE TABLE IF NOT EXISTS mail_counters (
  k TEXT NOT NULL,                  -- "e:" + HMAC(email) or "i:" + HMAC(ip); raw IPs are never stored
  day TEXT NOT NULL,                -- UTC YYYY-MM-DD
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (k, day)
);
-- bumped on password reset; JWTs carry it, so older sessions stop working
ALTER TABLE users ADD COLUMN token_ver INTEGER NOT NULL DEFAULT 0;
