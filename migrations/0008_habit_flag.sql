-- Streaks only for tasks explicitly marked as habit
ALTER TABLE tasks ADD COLUMN habit INTEGER NOT NULL DEFAULT 0;
UPDATE tasks SET habit = 1
WHERE recurrence IS NOT NULL AND (title LIKE '%Inbox Zero%' OR title LIKE '%WeWard%');
