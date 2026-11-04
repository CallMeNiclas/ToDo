CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO projects (id, name, color, sort) VALUES ('inbox', 'Eingang', '#64748b', -1);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'inbox' REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),
  due_date TEXT,              -- YYYY-MM-DD (local)
  due_time TEXT,              -- HH:MM (local), optional
  duration_min INTEGER,       -- planned duration in minutes
  recurrence TEXT,            -- JSON {freq, interval, days}
  labels TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
  reminders TEXT NOT NULL DEFAULT '[]',  -- JSON [{before:min}|{at:'YYYY-MM-DDTHH:MM'}]
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  place_event TEXT CHECK (place_event IN ('arrive','leave')),
  sort INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_open ON tasks (completed_at, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);

-- log of completions (also covers each occurrence of recurring tasks)
CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_completions_at ON completions (completed_at);

-- concrete scheduled notifications, regenerated whenever a task changes
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  fire_at TEXT NOT NULL,      -- ISO UTC
  email INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  UNIQUE (task_id, fire_at)
);
CREATE INDEX IF NOT EXISTS idx_notifications_due ON notifications (sent_at, fire_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
