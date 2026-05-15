export const SCHEMA = `
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active INTEGER DEFAULT 1,
  check_interval INTEGER DEFAULT 60,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_author TEXT,
  raw_content TEXT,
  ai_score REAL DEFAULT 0,
  ai_verified INTEGER DEFAULT 0,
  ai_analysis TEXT,
  keyword_id INTEGER,
  is_notified INTEGER DEFAULT 0,
  published_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  min_score REAL DEFAULT 60,
  push_enabled INTEGER DEFAULT 1,
  email_enabled INTEGER DEFAULT 0,
  quiet_hours_start TEXT,
  quiet_hours_end TEXT
);

CREATE INDEX IF NOT EXISTS idx_hotspots_keyword ON hotspots(keyword_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_score ON hotspots(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspots_discovered ON hotspots(discovered_at DESC);
`;
