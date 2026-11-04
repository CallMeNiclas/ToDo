-- Explicit "main project" flag; only main projects can have sub-projects (one level)
ALTER TABLE projects ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0;
UPDATE projects SET is_main = 1 WHERE id IN (SELECT DISTINCT parent_id FROM projects WHERE parent_id IS NOT NULL);
UPDATE projects SET parent_id = NULL WHERE is_main = 1;
