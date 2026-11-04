-- Area of a project for focus modes: 'work', 'private' or NULL (shown in both). Sub-projects inherit.
ALTER TABLE projects ADD COLUMN context TEXT CHECK (context IN ('work', 'private'));
