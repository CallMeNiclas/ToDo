import { parseQuickAdd, recurrenceLabel } from '../public/js/parse.js';
import { advance, nextOccurrence, zonedToUtc } from '../src/time.js';
const ctx = { today: '2026-11-04', projects: [{ id: 'p1', name: 'Arbeit' }, { id: 'p2', name: 'Haus und Garten' }] };
for (const t of [
  'Zahnarzt anrufen morgen 15 Uhr p1 #Arbeit @telefon 15min',
  'Müll rausbringen jeden Dienstag',
  'Rasen mähen #Haus und Garten übermorgen 1,5h',
  'Miete monatlich am 1.',
  'Sport jeden Montag und Donnerstag um 18:30',
  'Steuer am 15.12. p2',
  'Geburtstag Mama 3. März jährlich',
  'Bericht in 2 Wochen',
  'Meeting Freitag 9.30',
  'Wasser trinken täglich',
]) { const r = parseQuickAdd(t, ctx); console.log(JSON.stringify({ t, title: r.title, d: r.due_date, tm: r.due_time, p: r.priority, pr: r.project_id, l: r.labels, du: r.duration_min, rec: r.recurrence && recurrenceLabel(r.recurrence) })); }
console.log(advance({freq:'week',days:[2,4]},'2026-11-05'), advance({freq:'week',days:[2],interval:2},'2026-11-03'), advance({freq:'month',day:31},'2026-01-31'), advance({freq:'month',day:31},'2026-02-28'));
console.log(nextOccurrence({freq:'day'},'2026-11-01','2026-11-04'), zonedToUtc('2026-11-04','09:00','Europe/Berlin').toISOString(), zonedToUtc('2026-07-04','09:00','Europe/Berlin').toISOString(), zonedToUtc('2026-03-29','02:30','Europe/Berlin').toISOString());
