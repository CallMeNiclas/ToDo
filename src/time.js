// Time zone helpers. All task dates/times are stored as local (owner's zone) values;
// notification instants are stored as UTC ISO strings.

function parts(date, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  return Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
}

function offsetMin(date, tz) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Local date ("YYYY-MM-DD") + time ("HH:MM") in tz -> Date (UTC instant). */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMin(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = offsetMin(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

/** Date -> {date:"YYYY-MM-DD", time:"HH:MM"} in tz. */
export function localNow(tz, date = new Date()) {
  const p = parts(date, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** ISO weekday 1 (Mon) .. 7 (Sun) */
export function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function addMonths(dateStr, n, dayOfMonth) {
  const [y, m] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, last);
  return new Date(Date.UTC(ty, tm, day)).toISOString().slice(0, 10);
}

/**
 * Recurrence rule: {freq:'day'|'week'|'month'|'year', interval?:n, days?:[1..7], day?:1..31}
 * Returns the next due date strictly after `fromDate`.
 */
export function advance(rule, fromDate) {
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case 'day':
      return addDays(fromDate, interval);
    case 'week': {
      const days = (rule.days || []).filter((x) => x >= 1 && x <= 7).sort();
      if (!days.length) return addDays(fromDate, 7 * interval);
      const wd = isoWeekday(fromDate);
      const later = days.find((x) => x > wd);
      if (later) return addDays(fromDate, later - wd);
      // wrap to first day of the following (interval) week
      return addDays(fromDate, 7 * (interval - 1) + (7 - wd) + days[0]);
    }
    case 'month': {
      const dom = rule.day || +fromDate.slice(8, 10);
      return addMonths(fromDate, interval, dom);
    }
    case 'year': {
      const dom = +fromDate.slice(8, 10);
      return addMonths(fromDate, 12 * interval, dom);
    }
    default:
      return addDays(fromDate, 1);
  }
}

/** Next occurrence after completing a recurring task: always in the future (> today). */
export function nextOccurrence(rule, dueDate, today) {
  let next = advance(rule, dueDate || today);
  let guard = 0;
  while (next <= today && guard++ < 1000) next = advance(rule, next);
  return next;
}
