-- streak lookups per task
CREATE INDEX IF NOT EXISTS idx_completions_task ON completions (task_id, completed_at);
