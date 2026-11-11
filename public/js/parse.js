// Natural-language quick add (German), e.g.
// "Zahnarzt anrufen morgen 15 Uhr p1 #Privat @telefon 15min"
// "Müll rausbringen jeden Dienstag", "Bericht alle 2 Wochen", "Miete monatlich am 1."

const WD = { montag: 1, mo: 1, dienstag: 2, di: 2, mittwoch: 3, mi: 3, donnerstag: 4, do: 4, freitag: 5, fr: 5, samstag: 6, sa: 6, sonntag: 7, so: 7 };
const WD_RE = '(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)';
const MONTHS = { januar: 1, jan: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };
const MONTH_RE = '(januar|jan|februar|feb|märz|maerz|mär|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez)\\.?';

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}
function ymd(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCMonth() !== m - 1) return null;
  return t.toISOString().slice(0, 10);
}
function nextWeekday(today, wd, includeToday) {
  const cur = isoWeekday(today);
  let diff = (wd - cur + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(today, diff);
}
function addMonthsClamp(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * @param {string} text
 * @param {{today:string, projects?:{id,name}[]}} ctx
 * @returns {{title, due_date?, due_time?, priority?, project_id?, labels?, duration_min?, recurrence?, tokens: {type,label}[]}}
 */
export function parseQuickAdd(text, ctx) {
  const today = ctx.today;
  let s = ' ' + text + ' ';
  const out = { tokens: [] };
  // token keys the user dismissed in the preview – their words stay in the title
  const skip = ctx.skip || new Set();
  const take = (re, fn) => {
    const m = s.match(re);
    if (!m) return false;
    const r = fn(m);
    if (r === false) return false;
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    return true;
  };

  // dictation leaves punctuation behind
  s = s.replace(/[.,!?](?=\s)/g, (c, i) => (/\d/.test(s[i - 1]) ? c : ' '));

  // priority: "p1", "!1", spoken "Priorität eins" / "Prio 1"
  if (!skip.has('priority')) take(/\s(?:p|!)([1-4])(?=\s)/i, (m) => { out.priority = +m[1]; out.tokens.push({ type: 'priority', label: 'P' + m[1] }); }) ||
  take(/\s(?:mit\s+)?(?:priorität|prio)\s+(eins|zwei|drei|vier|[1-4])(?=\s)/i, (m) => {
    const n = { eins: 1, zwei: 2, drei: 3, vier: 4 }[m[1].toLowerCase()] || +m[1];
    out.priority = n; out.tokens.push({ type: 'priority', label: 'P' + n });
  }) ||
  take(/\s(?:ist\s+)?(?:sehr\s+)?(?:wichtig|dringend)(?=\s)/i, () => { out.priority = 1; out.tokens.push({ type: 'priority', label: 'P1' }); });

  // spoken project: "Projekt Arbeit", "im Projekt Haus und Garten"
  if (ctx.projects?.length && !skip.has('project')) {
    const m = s.match(/\s(?:(?:im|in|ins|zum)\s+)?projekt\s+/i);
    if (m) {
      const rest = s.slice(m.index + m[0].length).toLowerCase();
      const hit = [...ctx.projects].sort((a, b) => b.name.length - a.name.length)
        .find((p) => rest.startsWith(p.name.toLowerCase()) && /^\s/.test(rest.slice(p.name.length) || ' '));
      if (hit) {
        out.project_id = hit.id;
        out.tokens.push({ type: 'project', label: '#' + hit.name });
        s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length + hit.name.length);
      }
    }
  }

  // spoken label: "Label Telefon"
  const spokenLabels = [];
  if (!skip.has('label')) while (take(/\s(?:mit\s+)?label\s+([\p{L}\p{N}_-]+)(?=\s)/iu, (m) => { spokenLabels.push(m[1].toLowerCase()); })) { /* loop */ }

  // spoken durations
  const noDur = skip.has('duration');
  const NUM = { eine: 1, einer: 1, ein: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, zehn: 10, fünfzehn: 15, zwanzig: 20, dreißig: 30, fünfundvierzig: 45 };
  if (!noDur) take(/\s(?:für\s+|dauert\s+(?:ca\.?\s+|etwa\s+|so\s+)?)?(?:eine\s+)?halbe\s+stunde(?=\s)/i, () => { out.duration_min = 30; }) ||
  take(/\s(?:für\s+|dauert\s+(?:ca\.?\s+|etwa\s+|so\s+)?)?(?:anderthalb|eineinhalb)\s+stunden?(?=\s)/i, () => { out.duration_min = 90; }) ||
  take(/\s(?:für\s+|dauert\s+(?:ca\.?\s+|etwa\s+|so\s+)?)?(eine|einer|ein|zwei|drei|vier|fünf|sechs|\d+)\s+stunden?(?=\s)/i, (m) => { out.duration_min = (NUM[m[1].toLowerCase()] || +m[1]) * 60; }) ||
  take(/\s(?:für\s+|dauert\s+(?:ca\.?\s+|etwa\s+|so\s+)?)?(zehn|fünfzehn|zwanzig|dreißig|fünfundvierzig|\d+)\s+minuten(?=\s)/i, (m) => { out.duration_min = NUM[m[1].toLowerCase()] || +m[1]; });
  if (out.duration_min) out.tokens.push({ type: 'duration', label: fmtDuration(out.duration_min) });

  // project: "#Name" – match the longest existing project name
  if (ctx.projects?.length && !skip.has('project')) {
    const idx = s.indexOf('#');
    if (idx >= 0) {
      const rest = s.slice(idx + 1).toLowerCase();
      const hit = [...ctx.projects].sort((a, b) => b.name.length - a.name.length)
        .find((p) => rest.startsWith(p.name.toLowerCase()) && /^[\s]/.test(rest.slice(p.name.length) || ' '));
      if (hit) {
        out.project_id = hit.id;
        out.tokens.push({ type: 'project', label: '#' + hit.name });
        s = s.slice(0, idx) + ' ' + s.slice(idx + 1 + hit.name.length);
      }
    }
  }

  // labels
  const labels = [];
  if (!skip.has('label')) while (take(/\s@([\p{L}\p{N}_-]+)(?=\s)/u, (m) => { labels.push(m[1]); })) { /* loop */ }
  labels.push(...spokenLabels);
  if (labels.length) { out.labels = labels; labels.forEach((l) => out.tokens.push({ type: 'label', label: '@' + l })); }

  // duration
  if (!out.duration_min && !noDur) take(/\s(?:für\s+)?(\d+(?:[.,]\d+)?)\s?(min|minuten|m|h|std|stunden?)(?=\s)/i, (m) => {
    const n = parseFloat(m[1].replace(',', '.'));
    const mins = /^(h|std|stunde|stunden)$/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
    if (!(mins > 0)) return false;
    out.duration_min = mins;
    out.tokens.push({ type: 'duration', label: fmtDuration(mins) });
  });

  // recurrence
  let recStart = null;
  const recur = (rule, label, start) => { out.recurrence = rule; recStart = start; out.tokens.push({ type: 'recurrence', label }); };
  if (!skip.has('recurrence')) take(/\s(?:jeden\s+tag|täglich|taeglich)(?=\s)/i, () => recur({ freq: 'day' }, 'täglich', today)) ||
  take(/\s(?:jeden\s+werktag|werktags|wochentags)(?=\s)/i, () => recur({ freq: 'week', days: [1, 2, 3, 4, 5] }, 'werktags', nextWeekdayIn(today, [1, 2, 3, 4, 5]))) ||
  take(new RegExp(`\\s(?:jeden|jede[nm]?)\\s+${WD_RE}((?:\\s*(?:,|und|&)\\s*${WD_RE})*)(?=\\s)`, 'i'), (m) => {
    const names = (m[1] + ' ' + (m[2] || '')).toLowerCase().match(new RegExp(WD_RE, 'g'));
    const days = [...new Set(names.map((n) => WD[n]))].sort();
    recur({ freq: 'week', days }, 'jeden ' + names.map(cap).join(', '), nextWeekdayIn(today, days));
  }) ||
  take(/\s(?:jede\s+woche|wöchentlich|woechentlich)(?=\s)/i, () => recur({ freq: 'week' }, 'wöchentlich', null)) ||
  take(/\s(?:jeden\s+monat|monatlich)(?:\s+am\s+(\d{1,2})\.)?(?=\s)/i, (m) => {
    const day = m[1] ? +m[1] : null;
    recur({ freq: 'month', ...(day ? { day } : {}) }, day ? `monatlich am ${day}.` : 'monatlich', day ? nextMonthDay(today, day) : null);
  }) ||
  take(/\s(?:jedes\s+jahr|jährlich|jaehrlich)(?=\s)/i, () => recur({ freq: 'year' }, 'jährlich', null)) ||
  take(/\salle\s+(\d+)\s+(tage|wochen|monate|jahre)(?=\s)/i, (m) => {
    const n = +m[1];
    const freq = { tage: 'day', wochen: 'week', monate: 'month', jahre: 'year' }[m[2].toLowerCase()];
    recur({ freq, interval: n }, `alle ${n} ${m[2]}`, null);
  }) ||
  take(/\sjeden\s+(\d{1,2})\.(?=\s)/i, (m) => recur({ freq: 'month', day: +m[1] }, `monatlich am ${m[1]}.`, nextMonthDay(today, +m[1])));

  // deadline: "bis Freitag", "bis 15.12.", "deadline morgen", "Deadline 3. Dezember"
  if (!skip.has('deadline')) {
    const dm = s.match(/\s(?:bis(?:\s+spätestens)?|spätestens|deadline)\s+(?=\S)/i);
    if (dm) {
      const rest = ' ' + s.slice(dm.index + dm[0].length);
      const sub = parseQuickAdd(rest.split(/\s+(?=(?:p[1-4]|#|@)\b)/)[0], { today });
      // only accept when the date expression starts right after the keyword
      if (sub.due_date && !sub.due_time && sub.title.length < rest.trim().length) {
        const consumed = rest.trim().slice(0, rest.trim().length - (rest.trim().endsWith(sub.title) ? sub.title.length : 0)).trim();
        const startsWithDate = sub.title === '' || !rest.trim().startsWith(sub.title.split(' ')[0]);
        if (startsWithDate && consumed) {
          out.deadline = sub.due_date;
          out.tokens.push({ type: 'deadline', label: '🚩 ' + relDate(sub.due_date, today) });
          s = s.slice(0, dm.index) + ' ' + s.slice(dm.index + dm[0].length).replace(consumed, ' ');
        }
      }
    }
  }

  // date
  let date = null;
  const noDate = skip.has('date');
  if (!noDate) take(/\s(?:heute|hute)(?=\s)/i, () => { date = today; }) ||
  take(/\s(?:übermorgen|uebermorgen)(?=\s)/i, () => { date = addDays(today, 2); }) ||
  take(/\smorgen(?=\s)/i, () => { date = addDays(today, 1); }) ||
  take(/\s(?:nächste|naechste|kommende)\s+woche(?=\s)/i, () => { date = nextWeekday(today, 1, false); }) ||
  take(new RegExp(`\\s(?:(?:am|nächsten|naechsten|kommenden)\\s+)?${WD_RE}(?=\\s)`, 'i'), (m) => { date = nextWeekday(today, WD[m[1].toLowerCase()], false); }) ||
  take(/\sin\s+(\d+|einem|einer|zwei|drei)\s+(tag|tagen|woche|wochen|monat|monaten)(?=\s)/i, (m) => {
    const n = { einem: 1, einer: 1, zwei: 2, drei: 3 }[m[1].toLowerCase()] || +m[1];
    const u = m[2].toLowerCase();
    date = u.startsWith('tag') ? addDays(today, n) : u.startsWith('woche') ? addDays(today, 7 * n) : addMonthsClamp(today, n);
  }) ||
  take(/\s(?:am\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=\s)/, (m) => {
    const y0 = +today.slice(0, 4);
    let y = m[3] ? +m[3] : y0;
    if (y < 100) y += 2000;
    let d = ymd(y, +m[2], +m[1]);
    if (!d) return false;
    if (!m[3] && d < today) d = ymd(y + 1, +m[2], +m[1]);
    date = d;
  }) ||
  take(new RegExp(`\\s(?:am\\s+)?(\\d{1,2})\\.?\\s+${MONTH_RE}(?:\\s+(\\d{4}))?(?=\\s)`, 'i'), (m) => {
    const y0 = +today.slice(0, 4);
    const mon = MONTHS[m[2].toLowerCase()];
    let d = ymd(m[3] ? +m[3] : y0, mon, +m[1]);
    if (!d) return false;
    if (!m[3] && d < today) d = ymd(y0 + 1, mon, +m[1]);
    date = d;
  });

  // time
  if (!noDate) take(/\s(?:um\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*uhr)?(?=\s)/i, (m) => { out.due_time = `${m[1].padStart(2, '0')}:${m[2]}`; }) ||
  take(/\s(?:um\s+)?([01]?\d|2[0-3])\s*uhr(?=\s)/i, (m) => { out.due_time = `${m[1].padStart(2, '0')}:00`; }) ||
  take(/\sum\s+([01]?\d|2[0-3])(?=\s)/i, (m) => { out.due_time = `${m[1].padStart(2, '0')}:00`; });

  if (!date && out.recurrence) date = recStart || today;
  if (!date && out.due_time) date = out.due_time < nowTime() ? addDays(today, 1) : today;
  if (date) {
    out.due_date = date;
    out.tokens.unshift({ type: 'date', label: relDate(date, today) + (out.due_time ? ' ' + out.due_time : '') });
  } else if (out.due_time) {
    delete out.due_time;
  }
  if (out.recurrence?.freq === 'week' && !out.recurrence.days && date) out.recurrence.days = [isoWeekday(date)];
  if (out.recurrence?.freq === 'month' && !out.recurrence.day && date) out.recurrence.day = +date.slice(8, 10);

  out.title = s.replace(/\s+/g, ' ').trim();
  return out;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function nextWeekdayIn(today, days) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    if (days.includes(isoWeekday(d))) return d;
  }
  return today;
}
function nextMonthDay(today, day) {
  const [y, m] = today.split('-').map(Number);
  for (let k = 0; k < 13; k++) {
    const first = new Date(Date.UTC(y, m - 1 + k, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
    if (d >= today) return d;
  }
  return today;
}
const cap = (w) => w[0].toUpperCase() + w.slice(1);

export function fmtDuration(min) {
  if (!min) return '';
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

const WD_SHORT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MON_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export function relDate(date, today) {
  if (date === today) return 'Heute';
  if (date === addDays(today, 1)) return 'Morgen';
  if (date === addDays(today, -1)) return 'Gestern';
  const diff = (Date.parse(date) - Date.parse(today)) / 86400000;
  const [y, m, d] = date.split('-').map(Number);
  if (diff > 0 && diff < 7) return ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][isoWeekday(date)];
  const base = `${WD_SHORT[isoWeekday(date)]}, ${d}. ${MON_SHORT[m - 1]}`;
  return y === +today.slice(0, 4) ? base : `${base} ${y}`;
}

export function recurrenceLabel(r) {
  if (!r) return '';
  const n = r.interval || 1;
  if (r.freq === 'day') return n === 1 ? 'täglich' : `alle ${n} Tage`;
  if (r.freq === 'week') {
    const days = r.days || [];
    if (days.join() === '1,2,3,4,5' && n === 1) return 'werktags';
    const dl = days.map((d) => WD_SHORT[d]).join(', ');
    return (n === 1 ? 'wöchentlich' : `alle ${n} Wochen`) + (dl ? ` (${dl})` : '');
  }
  if (r.freq === 'month') return (n === 1 ? 'monatlich' : `alle ${n} Monate`) + (r.day ? ` am ${r.day}.` : '');
  if (r.freq === 'year') return n === 1 ? 'jährlich' : `alle ${n} Jahre`;
  return '';
}
