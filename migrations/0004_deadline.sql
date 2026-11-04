-- Separate deadline (latest finish date), distinct from the scheduled due date
ALTER TABLE tasks ADD COLUMN deadline TEXT;

-- Take over "Deadline: DD.MM.YYYY" lines that were written into notes as a workaround
UPDATE tasks SET deadline = substr(d, 7, 4) || '-' || substr(d, 4, 2) || '-' || substr(d, 1, 2)
FROM (SELECT id AS tid, substr(notes, instr(notes, 'Deadline: ') + 10, 10) AS d FROM tasks WHERE instr(notes, 'Deadline: ') > 0)
WHERE tasks.id = tid AND d GLOB '[0-9][0-9].[0-9][0-9].[0-9][0-9][0-9][0-9]';

UPDATE tasks SET notes = trim(
    replace(replace(notes,
      char(10) || char(10) || 'Deadline: ' || substr(deadline, 9, 2) || '.' || substr(deadline, 6, 2) || '.' || substr(deadline, 1, 4), ''),
      'Deadline: ' || substr(deadline, 9, 2) || '.' || substr(deadline, 6, 2) || '.' || substr(deadline, 1, 4), ''),
    char(10) || ' ')
WHERE deadline IS NOT NULL;

-- what a scheduled notification is about ('reminder' or 'deadline')
ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'reminder';
