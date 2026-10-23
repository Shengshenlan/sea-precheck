-- Reliable daily counters (site-wide check quota, per-IP check quota, site-wide mail quota) + one in-flight check per account.
CREATE TABLE IF NOT EXISTS daily_counters (
  k TEXT NOT NULL,                  -- "g:check" | "g:mail" | "ci:" + HMAC(ip); raw IPs are never stored
  day TEXT NOT NULL,                -- UTC YYYY-MM-DD
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (k, day)
);
CREATE TABLE IF NOT EXISTS inflight (
  user_id INTEGER PRIMARY KEY,      -- at most one running check per account
  started_at INTEGER NOT NULL       -- ms epoch; stale locks (crashed isolate) expire after the request timeout
);
