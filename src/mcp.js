// Minimal MCP server (Streamable HTTP transport, JSON responses, stateless).
// Lets Claude read and manage tasks directly.
import * as T from './tasks.js';
import { listEvents, GoogleNotConnected } from './google.js';
import { healthSummary } from './health.js';
import { localNow, addDays, isoWeekday, zonedToUtc } from './time.js';

const PROTOCOL_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const taskFields = {
  title: { type: 'string', description: 'Titel der Aufgabe' },
  notes: { type: 'string', description: 'Beschreibung / Notizen (Markdown erlaubt)' },
  project: { type: 'string', description: 'Projekt-ID, Name oder Pfad für Unterprojekte, z. B. "Fundus7/To-Do\'s" (Standard: Eingang)' },
  parent_id: { type: ['string', 'null'], description: 'ID der übergeordneten Aufgabe → wird Unteraufgabe' },
  priority: { type: 'integer', minimum: 1, maximum: 4, description: '1 = höchste (rot), 4 = keine' },
  due_date: { type: ['string', 'null'], description: 'Fälligkeitsdatum YYYY-MM-DD (lokal, Europe/Berlin). null entfernt das Datum.' },
  due_time: { type: ['string', 'null'], description: 'Uhrzeit HH:MM (24h), optional' },
  duration_min: { type: ['integer', 'null'], description: 'Geplante Dauer in Minuten' },
  deadline: { type: ['string', 'null'], description: 'Deadline YYYY-MM-DD: bis wann es spätestens fertig sein muss (unabhängig von due_date = wann es geplant ist). Am Deadline-Tag kommt morgens eine Push-Nachricht. null entfernt sie. NICHT in die Notizen schreiben.' },
  recurrence: {
    type: ['object', 'null'],
    description: 'Wiederholung. Beispiele: täglich {freq:"day"}, alle 2 Tage {freq:"day",interval:2}, Mo+Do {freq:"week",days:[1,4]}, werktags {freq:"week",days:[1,2,3,4,5]}, monatlich am 15. {freq:"month",day:15}, jährlich {freq:"year"}. Benötigt due_date (= erstes Vorkommen). null entfernt sie.',
    properties: {
      freq: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
      interval: { type: 'integer', minimum: 1 },
      days: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 7 }, description: 'ISO-Wochentage 1=Mo … 7=So' },
      day: { type: 'integer', minimum: 1, maximum: 31 },
    },
    required: ['freq'],
  },
  labels: { type: 'array', items: { type: 'string' }, description: 'Labels (ersetzt die bisherigen)' },
  reminders: {
    type: 'array',
    description: 'Push-Erinnerungen (ersetzt bisherige; [] = Standard). Pro Eintrag ENTWEDER {"before": Minuten} = X Min. vor due_date+due_time (braucht due_time) ODER {"at": "YYYY-MM-DDTHH:MM"} = fester Zeitpunkt (lokale Zeit Europe/Berlin, funktioniert auch ohne due_date) ODER {"time": "HH:MM"} = am Fälligkeitstag um diese Uhrzeit. Ohne eigene Erinnerungen gilt automatisch: Aufgaben mit Uhrzeit → Push 15 Min. vorher; Prio 1 ohne Uhrzeit → Push+Mail morgens am Fälligkeitstag. Prio-1-Aufgaben ohne Wiederholung bekommen zusätzlich eine Mail.',
    items: {
      type: 'object',
      properties: {
        before: { type: 'integer', minimum: 0, maximum: 10080, description: 'Minuten vor der Fälligkeit' },
        at: { type: 'string', description: 'YYYY-MM-DDTHH:MM (lokal)' },
        time: { type: 'string', description: 'HH:MM am Fälligkeitstag' },
      },
    },
  },
  place: { type: ['string', 'null'], description: 'Name eines gespeicherten Orts für standortbasierte Erinnerung (siehe list_places). null entfernt ihn.' },
  place_event: { type: 'string', enum: ['arrive', 'leave'], description: 'Erinnern beim Ankommen (Standard) oder Verlassen' },
};

const TOOLS = [
  {
    name: 'get_overview',
    description: 'Überblick: heutiges Datum, Anzahl offener Aufgaben (überfällig/heute/diese Woche/gesamt), heutige Aufgaben und heutige Kalendertermine. Guter Startpunkt.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'find_tasks',
    description: 'Offene Aufgaben suchen/filtern. Ohne Parameter: alle offenen Aufgaben.',
    inputSchema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['today', 'overdue', 'week', 'upcoming', 'no_date', 'all'], description: 'today = heute + überfällig; week = bis Sonntag; upcoming = ab morgen' },
        project: { type: 'string', description: 'Projekt-ID, Name oder Pfad. Hauptprojekte schließen ihre Unterprojekte ein.' },
        label: { type: 'string' },
        priority: { type: 'integer', minimum: 1, maximum: 4 },
        search: { type: 'string', description: 'Volltext in Titel und Notizen' },
        from_date: { type: 'string', description: 'YYYY-MM-DD' },
        to_date: { type: 'string', description: 'YYYY-MM-DD (inklusive)' },
        limit: { type: 'integer', default: 100 },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_task',
    description: 'Eine Aufgabe inkl. Notizen und Unteraufgaben laden.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_tasks',
    description: 'Eine oder mehrere Aufgaben anlegen. Für Unteraufgaben parent_id einer bestehenden Aufgabe angeben, oder `subtasks` verschachteln.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array', minItems: 1, maxItems: 50,
          items: {
            type: 'object',
            properties: { ...taskFields, subtasks: { type: 'array', items: { type: 'object', properties: taskFields, required: ['title'] } } },
            required: ['title'],
          },
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'update_tasks',
    description: 'Aufgaben ändern (verschieben, umbenennen, Prio, Datum, Dauer, Labels …). Nur angegebene Felder werden geändert.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', properties: { id: { type: 'string' }, ...taskFields }, required: ['id'] } },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'complete_tasks',
    description: 'Aufgaben abhaken. Wiederkehrende Aufgaben springen auf das nächste Datum.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['ids'] },
  },
  {
    name: 'reopen_tasks',
    description: 'Erledigte Aufgaben wieder öffnen.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['ids'] },
  },
  {
    name: 'delete_tasks',
    description: 'Aufgaben endgültig löschen (inkl. Unteraufgaben). Nur auf ausdrücklichen Wunsch – zum Abhaken complete_tasks nutzen.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['ids'] },
    annotations: { destructiveHint: true },
  },
  {
    name: 'find_completed_tasks',
    description: 'Zuletzt erledigte Aufgaben.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 30 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_projects',
    description: 'Alle Projekte mit Anzahl offener Aufgaben.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'manage_project',
    description: 'Projekt anlegen, umbenennen/umfärben/zuordnen (mit id) oder löschen (action=delete, löscht auch Unterprojekte und alle Aufgaben darin). Struktur: Hauptprojekte (is_main) enthalten Unterprojekte, eine Ebene tief. Zuordnen: parent = Hauptprojekt.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'delete'] },
        id: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string', description: 'Hex, z. B. #10b981' },
        parent: { type: ['string', 'null'], description: 'Hauptprojekt, dem das Projekt untergeordnet wird (ID oder Name, z. B. "Fundus7"). Wird bei Bedarf automatisch zum Hauptprojekt. null = keinem zugeordnet.' },
        is_main: { type: 'boolean', description: 'Als Hauptprojekt markieren (kann dann Unterprojekte haben). false = Unterprojekte werden zu normalen Projekten.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'Termine aus Google Kalender (nur lesen) für einen Zeitraum.',
    inputSchema: {
      type: 'object',
      properties: { from_date: { type: 'string', description: 'YYYY-MM-DD, Standard heute' }, to_date: { type: 'string', description: 'YYYY-MM-DD inklusive, Standard = from_date' } },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_health',
    description: 'Apple-Health-Daten des Nutzers pro Tag (Schritte inkl. Tagesziel, Schlaf mit Phasen, aktive Energie, Ruhepuls, Gewicht …), sofern synchronisiert.',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', default: 7, minimum: 1, maximum: 90 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_places',
    description: 'Gespeicherte Orte für standortbasierte Erinnerungen.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_place',
    description: 'Neuen Ort anlegen (z. B. "Zuhause", "Büro", "REWE"). Damit er auslöst, muss auf dem iPhone eine Kurzbefehl-Automation dafür eingerichtet sein (siehe Einstellungen der App).',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
];

// ---------- helpers ----------
async function ctx(env) {
  const [projects, places] = await Promise.all([T.listProjects(env), T.listPlaces(env)]);
  return { projects, places, today: localNow(env.TIMEZONE).date };
}

/** "Fundus7 / To-Do's" for sub-projects */
function projectPath(c, id) {
  const parts = [];
  let p = c.projects.find((x) => x.id === id);
  for (let i = 0; p && i < 10; i++) {
    parts.unshift(p.name);
    p = p.parent_id ? c.projects.find((x) => x.id === p.parent_id) : null;
  }
  return parts.join(' / ') || id;
}

/** Accepts an id, a unique name, or a path like "Fundus7/To-Do's". */
function resolveProject(c, ref) {
  if (ref === undefined) return undefined;
  if (!ref) return 'inbox';
  const r = String(ref).trim();
  const byId = c.projects.find((x) => x.id === r);
  if (byId) return byId.id;
  const normPath = (x) => x.toLowerCase().split('/').map((y) => y.trim()).join('/');
  const byPath = c.projects.filter((x) => normPath(projectPath(c, x.id)) === normPath(r));
  if (byPath.length === 1) return byPath[0].id;
  const byName = c.projects.filter((x) => x.name.toLowerCase() === r.toLowerCase());
  if (byName.length === 1) return byName[0].id;
  const all = c.projects.map((x) => projectPath(c, x.id)).join(', ');
  if (byName.length > 1) throw new T.InputError(`Projektname "${ref}" ist mehrdeutig. Bitte Pfad angeben, z. B. ${byName.map((x) => '"' + projectPath(c, x.id) + '"').join(' oder ')}`);
  throw new T.InputError(`Projekt "${ref}" nicht gefunden. Vorhanden: ${all}`);
}
function resolvePlace(c, ref) {
  if (ref === undefined) return undefined;
  if (!ref) return null;
  const p = c.places.find((x) => x.id === ref) || c.places.find((x) => x.name.toLowerCase() === String(ref).toLowerCase());
  if (!p) throw new T.InputError(`Ort "${ref}" nicht gefunden. Vorhanden: ${c.places.map((x) => x.name).join(', ') || 'keine'} – ggf. add_place nutzen.`);
  return p.id;
}

function toInput(c, a) {
  const input = { ...a };
  delete input.id; delete input.project; delete input.place; delete input.subtasks;
  if ('project' in a) input.project_id = resolveProject(c, a.project);
  if ('place' in a) input.place_id = resolvePlace(c, a.place);
  return input;
}

function view(c, t, all) {
  const out = {
    id: t.id,
    title: t.title,
    project: projectPath(c, t.project_id),
    priority: t.priority,
  };
  if (t.parent_id) out.parent_id = t.parent_id;
  if (t.due_date) out.due_date = t.due_date;
  if (t.due_time) out.due_time = t.due_time;
  if (t.duration_min) out.duration_min = t.duration_min;
  if (t.deadline) out.deadline = t.deadline;
  if (t.recurrence) out.recurrence = t.recurrence;
  if (t.labels.length) out.labels = t.labels;
  if (t.notes) out.notes = t.notes.length > 300 ? t.notes.slice(0, 300) + '…' : t.notes;
  if (t.reminders.length) out.reminders = t.reminders;
  if (t.place_id) out.place = { name: c.places.find((p) => p.id === t.place_id)?.name, event: t.place_event };
  if (t.completed_at) out.completed_at = t.completed_at;
  if (all) {
    const subs = all.filter((s) => s.parent_id === t.id);
    if (subs.length) out.subtask_count = subs.length;
  }
  return out;
}

function endOfWeek(today) {
  return addDays(today, 7 - isoWeekday(today));
}

function sortTasks(list) {
  return list.sort((a, b) =>
    (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
    (a.due_time || '99').localeCompare(b.due_time || '99') ||
    a.priority - b.priority);
}

async function calendar(env, from, toInclusive) {
  try {
    const ev = await listEvents(env, zonedToUtc(from, '00:00', env.TIMEZONE).toISOString(), zonedToUtc(addDays(toInclusive, 1), '00:00', env.TIMEZONE).toISOString());
    return ev.map((e) => ({ title: e.title, start: e.start, end: e.end, all_day: e.allDay, calendar: e.calendar, location: e.location || undefined }));
  } catch (e) {
    return { error: e instanceof GoogleNotConnected ? 'Google Kalender nicht verbunden' : e.message };
  }
}

// ---------- tool implementations ----------
async function callTool(env, name, a = {}) {
  const c = await ctx(env);
  switch (name) {
    case 'get_overview': {
      const all = await T.listOpenTasks(env);
      const eow = endOfWeek(c.today);
      const dated = all.filter((t) => t.due_date);
      const overdue = dated.filter((t) => t.due_date < c.today);
      const today = dated.filter((t) => t.due_date === c.today);
      const week = dated.filter((t) => t.due_date <= eow);
      return {
        today: c.today,
        weekday: new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: env.TIMEZONE }).format(new Date()),
        counts: { overdue: overdue.length, today: today.length, this_week_incl_overdue: week.length, open_total: all.length },
        planned_minutes_today: today.reduce((n, t) => n + (t.duration_min || 0), 0),
        deadlines_next_7_days: sortTasks(all.filter((t) => t.deadline && t.deadline <= addDays(c.today, 7)))
          .sort((x, y) => x.deadline.localeCompare(y.deadline)).map((t) => view(c, t, all)),
        overdue: sortTasks(overdue).map((t) => view(c, t, all)),
        due_today: sortTasks(today).map((t) => view(c, t, all)),
        calendar_today: await calendar(env, c.today, c.today),
      };
    }
    case 'find_tasks': {
      const all = await T.listOpenTasks(env);
      let list = all;
      const eow = endOfWeek(c.today);
      if (a.view === 'today') list = list.filter((t) => t.due_date && t.due_date <= c.today);
      if (a.view === 'overdue') list = list.filter((t) => t.due_date && t.due_date < c.today);
      if (a.view === 'week') list = list.filter((t) => t.due_date && t.due_date <= eow);
      if (a.view === 'upcoming') list = list.filter((t) => t.due_date && t.due_date > c.today);
      if (a.view === 'no_date') list = list.filter((t) => !t.due_date);
      if (a.project) {
        const ids = new Set([resolveProject(c, a.project)]);
        for (let grew = true; grew;) { grew = false; for (const p of c.projects) if (p.parent_id && ids.has(p.parent_id) && !ids.has(p.id)) { ids.add(p.id); grew = true; } }
        list = list.filter((t) => ids.has(t.project_id));
      }
      if (a.label) list = list.filter((t) => t.labels.some((l) => l.toLowerCase() === a.label.replace(/^@/, '').toLowerCase()));
      if (a.priority) list = list.filter((t) => t.priority === a.priority);
      if (a.from_date) list = list.filter((t) => t.due_date && t.due_date >= a.from_date);
      if (a.to_date) list = list.filter((t) => t.due_date && t.due_date <= a.to_date);
      if (a.search) {
        const q = a.search.toLowerCase();
        list = list.filter((t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
      }
      const limit = Math.min(500, a.limit || 100);
      return { today: c.today, count: list.length, tasks: sortTasks(list).slice(0, limit).map((t) => view(c, t, all)) };
    }
    case 'get_task': {
      const t = await T.getTask(env, a.id);
      if (!t) throw new T.InputError('Aufgabe nicht gefunden');
      const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE parent_id = ? ORDER BY sort, created_at').bind(t.id).all();
      return { ...view(c, t), notes: t.notes, subtasks: results.map(T.rowToTask).map((s) => view(c, s)) };
    }
    case 'add_tasks': {
      const created = [];
      const failures = [];
      for (const [i, item] of (a.tasks || []).entries()) {
        try {
          const t = await T.createTask(env, toInput(c, item));
          created.push(view(c, t));
          for (const sub of item.subtasks || []) {
            const s = await T.createTask(env, { ...toInput(c, sub), parent_id: t.id });
            created.push(view(c, s));
          }
        } catch (e) {
          if (!(e instanceof T.InputError)) throw e;
          failures.push({ index: i, title: item.title, error: e.message });
        }
      }
      return { created, failures };
    }
    case 'update_tasks': {
      const updated = [];
      const failures = [];
      for (const item of a.tasks || []) {
        try {
          updated.push(view(c, await T.updateTask(env, item.id, toInput(c, item))));
        } catch (e) {
          if (!(e instanceof T.InputError)) throw e;
          failures.push({ id: item.id, error: e.message });
        }
      }
      return { updated, failures };
    }
    case 'complete_tasks':
    case 'reopen_tasks':
    case 'delete_tasks': {
      const done = [];
      const failures = [];
      for (const id of a.ids || []) {
        try {
          if (name === 'complete_tasks') {
            const r = await T.completeTask(env, id);
            done.push({ id, title: r.task.title, ...(r.recurred ? { next_due_date: r.task.due_date } : {}) });
          } else if (name === 'reopen_tasks') {
            const t = await T.uncompleteTask(env, id);
            done.push({ id, title: t.title });
          } else {
            done.push(await T.deleteTask(env, id));
          }
        } catch (e) {
          if (!(e instanceof T.InputError)) throw e;
          failures.push({ id, error: e.message });
        }
      }
      return { done, failures };
    }
    case 'find_completed_tasks': {
      const list = await T.listCompleted(env, Math.min(200, a.limit || 30));
      return { tasks: list.map((t) => view(c, t)) };
    }
    case 'list_projects': {
      const { results } = await env.DB.prepare('SELECT project_id, COUNT(*) AS n FROM tasks WHERE completed_at IS NULL GROUP BY project_id').all();
      return {
        projects: c.projects.map((p) => ({
          id: p.id, name: p.name, path: projectPath(c, p.id), is_main: !!p.is_main, parent_id: p.parent_id || null, color: p.color,
          open_tasks: results.find((r) => r.project_id === p.id)?.n || 0,
        })),
      };
    }
    case 'manage_project': {
      const parent = a.parent === undefined ? undefined : a.parent ? resolveProject(c, a.parent) : null;
      if (a.action === 'create') return T.createProject(env, { name: a.name, color: a.color, parent_id: parent, is_main: a.is_main }, { promote: true });
      const id = resolveProject(c, a.id || a.name);
      if (a.action === 'update') return T.updateProject(env, id, { name: a.id ? a.name : undefined, color: a.color, parent_id: parent, is_main: a.is_main }, { promote: true });
      if (a.action === 'delete') return T.deleteProject(env, id);
      throw new T.InputError('Unbekannte action');
    }
    case 'list_calendar_events': {
      const from = a.from_date || c.today;
      const to = a.to_date || from;
      return { from, to, events: await calendar(env, from, to) };
    }
    case 'get_health': {
      const h = await healthSummary(env, a.days || 7);
      const days = h.days.map((d) => {
        const o = { date: d.date };
        for (const [k, v] of Object.entries(d)) if (k !== 'date') o[k] = v;
        return o;
      });
      return { today: h.today, step_goal: h.goal, last_sync: h.lastSync, units: h.units, days };
    }
    case 'list_places':
      return { places: c.places.map((p) => ({ id: p.id, name: p.name })) };
    case 'add_place':
      return T.createPlace(env, a);
    default:
      throw new RpcError(-32602, 'Unknown tool: ' + name);
  }
}

class RpcError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function handleRpc(env, msg) {
  const { id, method, params } = msg;
  const result = (r) => ({ jsonrpc: '2.0', id, result: r });
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return result({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'todo', title: 'NTD’s – Nic’s To-Do’s', version: '1.0.0' },
        instructions: 'Persönliche To-Do-App des Nutzers (Zeitzone Europe/Berlin). Starte bei Fragen zum Tag mit get_overview. Prioritäten: 1 = dringend/rot … 4 = keine. Daten immer als YYYY-MM-DD, Uhrzeiten HH:MM. due_date = wann geplant; deadline = bis wann spätestens fertig (eigenes Feld, nicht in Notizen schreiben). Erinnerungen über das Feld reminders setzen; Antworten enthalten das gespeicherte Ergebnis – bei Fehlern kommt eine Meldung in failures.',
      });
    }
    case 'ping':
      return result({});
    case 'tools/list':
      return result({ tools: TOOLS });
    case 'tools/call': {
      try {
        const data = await callTool(env, params?.name, params?.arguments || {});
        return result({ content: [{ type: 'text', text: JSON.stringify(data, null, 1) }], structuredContent: Array.isArray(data) ? { items: data } : data });
      } catch (e) {
        if (e instanceof RpcError) throw e;
        if (e instanceof T.InputError) return result({ content: [{ type: 'text', text: 'Fehler: ' + e.message }], isError: true });
        console.error(e);
        return result({ content: [{ type: 'text', text: 'Serverfehler: ' + e.message }], isError: true });
      }
    }
    case 'resources/list':
      return result({ resources: [] });
    case 'prompts/list':
      return result({ prompts: [] });
    default:
      throw new RpcError(-32601, 'Method not found: ' + method);
  }
}

export async function handleMcp(request, env) {
  if (request.method === 'GET') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const msgs = batch ? body : [body];
  const out = [];
  for (const msg of msgs) {
    if (msg.id === undefined || msg.id === null) continue; // notification
    try {
      out.push(await handleRpc(env, msg));
    } catch (e) {
      out.push({ jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: e.message } });
    }
  }
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(batch ? out : out[0]);
}
