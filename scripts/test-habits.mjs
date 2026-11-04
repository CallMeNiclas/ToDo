// quick unit test of streak logic with a fake env
import { habits } from '../src/habits.js';
const tasks = [
  { id: 'd', title: 'Daily', recurrence: { freq: 'day' }, due_date: '2026-11-05', labels: '[]', reminders: '[]' },
  { id: 'w', title: 'Mo-Mi-Fr', recurrence: { freq: 'week', days: [1, 3, 5] }, due_date: '2026-11-04', labels: '[]', reminders: '[]' },
];
const comps = [
  ...['2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => ({ task_id: 'd', completed_at: d + 'T10:00:00Z' })),
  ...['2026-10-19', '2026-10-21', '2026-10-23', '2026-10-27', '2026-10-28', '2026-10-30', '2026-11-02'].map((d) => ({ task_id: 'w', completed_at: d + 'T10:00:00Z' })),
];
const env = { TIMEZONE: 'Europe/Berlin', DB: { prepare: (sql) => ({ bind: () => ({ all: async () => ({ results: sql.includes('completions') ? comps : tasks.map((t) => ({ ...t, recurrence: JSON.stringify(t.recurrence), completed_at: null })) }) }), all: async () => ({ results: tasks.map((t) => ({ ...t, recurrence: JSON.stringify(t.recurrence), completed_at: null })) }) }) } };
const r = await habits(env);
for (const h of r.habits) console.log(h.title, 'current', h.current, 'best', h.best, 'rate30', h.rate_30, `${h.done_30}/${h.due_30}`);
