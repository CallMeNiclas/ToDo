-- Focus timer sessions (one active at a time) and total focus time per task
CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  planned_min INTEGER NOT NULL,
  started_at TEXT NOT NULL,          -- ISO UTC
  paused_at TEXT,                    -- set while paused
  paused_sec INTEGER NOT NULL DEFAULT 0,
  ended_at TEXT,                     -- set when stopped / finished
  actual_sec INTEGER
);
CREATE INDEX IF NOT EXISTS idx_focus_active ON focus_sessions (ended_at);
ALTER TABLE tasks ADD COLUMN focus_sec INTEGER NOT NULL DEFAULT 0;
