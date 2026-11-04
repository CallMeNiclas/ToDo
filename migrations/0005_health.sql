-- Apple Health data pushed by "Health Auto Export" (one row per metric and sample timestamp)
CREATE TABLE IF NOT EXISTS health_samples (
  metric TEXT NOT NULL,       -- e.g. step_count, sleep_analysis, active_energy
  ts TEXT NOT NULL,           -- sample timestamp as sent ("2026-11-04 00:00:00 +0100")
  day TEXT NOT NULL,          -- local date YYYY-MM-DD
  qty REAL,                   -- main value (steps, kcal, hours of sleep …)
  unit TEXT,
  extra TEXT,                 -- JSON with further fields (sleep phases, min/max …)
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (metric, ts)
);
CREATE INDEX IF NOT EXISTS idx_health_day ON health_samples (metric, day);
