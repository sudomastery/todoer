import { addDays, addMonths, addYears, format, getDay, parseISO, setDate } from 'date-fns';
import { todayISO, toISODate } from './dates';

/**
 * Recurrence rules are stored as compact strings:
 *   'daily'                   every day
 *   'weekdays'                every Monday-Friday
 *   'weekly:1'                every week on that weekday (0=Sun .. 6=Sat)
 *   'monthly:15'              every month on that day of month
 *   'yearly'                  every year on the due date
 *   'every:3:days'            every N days (also weeks, months, years)
 */

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function describeRecurrence(rule: string): string {
  if (rule === 'daily') return 'every day';
  if (rule === 'weekdays') return 'every weekday';
  if (rule === 'yearly') return 'every year';
  if (rule.startsWith('weekly:')) {
    const wd = Number(rule.split(':')[1]);
    const name = WEEKDAY_NAMES[wd] ?? 'week';
    return `every ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }
  if (rule.startsWith('monthly:')) {
    return `every month on the ${ordinal(Number(rule.split(':')[1]))}`;
  }
  if (rule.startsWith('every:')) {
    const [, n, unit] = rule.split(':');
    return Number(n) === 1 ? `every ${unit.replace(/s$/, '')}` : `every ${n} ${unit}`;
  }
  return rule;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Parse a natural-language recurrence phrase. Returns null when the text
 * is not a recurrence. Examples: 'every day', 'every weekday',
 * 'every monday', 'every 3 weeks', 'every month', 'every year', 'daily', 'weekly', 'monthly'.
 */
export function parseRecurrence(text: string, dueDate?: string): string | null {
  const t = text.trim().toLowerCase();

  if (t === 'daily' || t === 'every day') return 'daily';
  if (t === 'every weekday' || t === 'weekdays') return 'weekdays';
  if (t === 'yearly' || t === 'annually' || t === 'every year') return 'yearly';

  if (t === 'weekly' || t === 'every week') {
    const base = dueDate ? parseISO(dueDate) : new Date();
    return `weekly:${getDay(base)}`;
  }
  if (t === 'monthly' || t === 'every month') {
    const base = dueDate ? parseISO(dueDate) : new Date();
    return `monthly:${base.getDate()}`;
  }

  const weekdayMatch = t.match(/^every (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (weekdayMatch) {
    return `weekly:${WEEKDAY_NAMES.indexOf(weekdayMatch[1])}`;
  }

  const intervalMatch = t.match(/^every (\d+) (day|week|month|year)s?$/);
  if (intervalMatch) {
    return `every:${intervalMatch[1]}:${intervalMatch[2]}s`;
  }

  const otherMatch = t.match(/^every other (day|week|month|year)$/);
  if (otherMatch) {
    return `every:2:${otherMatch[1]}s`;
  }

  return null;
}

/**
 * Compute the next due date after completing a recurring task.
 * Advances from the later of the current due date and today, so completing
 * an overdue daily task schedules it for tomorrow, not for a past date.
 */
export function nextOccurrence(rule: string, currentDue: string | null): string {
  const today = todayISO();
  const base = parseISO(currentDue && currentDue > today ? currentDue : today);

  if (rule === 'daily') return toISODate(addDays(base, 1));

  if (rule === 'weekdays') {
    let d = addDays(base, 1);
    while (getDay(d) === 0 || getDay(d) === 6) d = addDays(d, 1);
    return toISODate(d);
  }

  if (rule.startsWith('weekly:')) {
    const target = Number(rule.split(':')[1]);
    let d = addDays(base, 1);
    while (getDay(d) !== target) d = addDays(d, 1);
    return toISODate(d);
  }

  if (rule.startsWith('monthly:')) {
    const day = Number(rule.split(':')[1]);
    let d = addMonths(base, 1);
    // clamp to the last day of shorter months
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d = setDate(d, Math.min(day, monthEnd));
    return toISODate(d);
  }

  if (rule === 'yearly') return toISODate(addYears(base, 1));

  if (rule.startsWith('every:')) {
    const [, nStr, unit] = rule.split(':');
    const n = Number(nStr);
    if (unit === 'days') return toISODate(addDays(base, n));
    if (unit === 'weeks') return toISODate(addDays(base, n * 7));
    if (unit === 'months') return toISODate(addMonths(base, n));
    if (unit === 'years') return toISODate(addYears(base, n));
  }

  // unknown rule: fall back to tomorrow so the task is never lost
  return toISODate(addDays(base, 1));
}

/** Format 'yyyy-MM-dd' for display in recurrence contexts. */
export function formatRecurrenceDate(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}
