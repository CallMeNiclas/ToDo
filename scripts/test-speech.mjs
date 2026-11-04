import { parseQuickAdd } from '../public/js/parse.js';
const ctx = { today: '2026-11-04', projects: [{ id: 'p1', name: 'Arbeit' }, { id: 'p2', name: 'Haus und Garten' }] };
for (const t of [
  'Tom wegen Inventur anrufen morgen um 10 Uhr Priorität eins Projekt Arbeit.',
  'Präsentation fertig machen Freitag dauert etwa zwei Stunden prio 2',
  'Rasen mähen im Projekt Haus und Garten übermorgen eine halbe Stunde',
  'Milch kaufen label einkauf',
  'Steuerberater anrufen ist wichtig morgen',
  'Bericht 1,5h p3 #Arbeit',
  'Zahnarzt am 15.12. um 9.30 Uhr',
]) { const r = parseQuickAdd(t, ctx); console.log(JSON.stringify({ title: r.title, d: r.due_date, tm: r.due_time, p: r.priority, pr: r.project_id, l: r.labels, du: r.duration_min })); }
