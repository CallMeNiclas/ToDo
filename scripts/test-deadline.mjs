import { parseQuickAdd } from '../public/js/parse.js';
const ctx = { today: '2026-11-04', projects: [{ id: 'p1', name: 'Arbeit' }] };
for (const t of ['Bericht schreiben morgen bis Freitag p1', 'Tourenplan KW 47 bis 08.11.', 'Angebot prüfen deadline morgen #Arbeit', 'Bis später anrufen', 'Steuer bis spätestens 15.12.', 'Spedi bestellen Donnerstag 9:45 bis Freitag'])
  { const r = parseQuickAdd(t, ctx); console.log(JSON.stringify({ t, title: r.title, d: r.due_date, tm: r.due_time, dl: r.deadline, p: r.priority, pr: r.project_id })); }
