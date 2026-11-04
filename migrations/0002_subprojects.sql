-- Sub-projects: a project can belong to a parent project
ALTER TABLE projects ADD COLUMN parent_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects (parent_id);
