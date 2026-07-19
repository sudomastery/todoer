import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Today's date as 'yyyy-MM-dd' in the device's local timezone. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function isOverdue(dueDate: string): boolean {
  return dueDate < todayISO();
}

export function isToday(dueDate: string): boolean {
  return dueDate === todayISO();
}

/** Human date label: Today, Tomorrow, Yesterday, weekday for this week, else 'Jul 21' or 'Jul 21 2027'. */
export function formatDueDate(dueDate: string): string {
  const date = startOfDay(parseISO(dueDate));
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(date, today);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(date, 'EEEE');
  if (isSameYear(date, today)) return format(date, 'MMM d');
  return format(date, 'MMM d yyyy');
}

/** '09:30:00' -> '9:30 AM' */
export function formatDueTime(dueTime: string): string {
  const [h, m] = dueTime.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, 'h:mm a');
}

export function formatDue(dueDate: string, dueTime: string | null): string {
  const base = formatDueDate(dueDate);
  return dueTime ? `${base} ${formatDueTime(dueTime)}` : base;
}

/** The next `count` days starting today, as ISO dates. */
export function upcomingDays(count: number): string[] {
  const start = new Date();
  return Array.from({ length: count }, (_, i) => toISODate(addDays(start, i)));
}

/**
 * Turns typed time text into the 'HH:MM:SS' the database stores, or null when
 * it is not a usable time. Accepts '9', '9:30', '0930', '9pm', '9:30 PM'.
 */
export function parseTimeInput(input: string): string | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const match = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/.exec(text);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  } else if (hours > 23) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

/** Weekday headings for a Monday-first grid, matching monthGrid's column order. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The calendar grid covering `month`, as Monday-first weeks. Includes the
 * trailing days of the previous month and the leading days of the next so
 * every row holds seven days. Shared by the calendar views and the due date
 * pickers so they always agree on which day sits in which column.
 */
export function monthGrid(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** 'Mon 21 Jul' style heading for Upcoming view. */
export function formatDayHeading(iso: string): string {
  const date = parseISO(iso);
  const diff = differenceInCalendarDays(startOfDay(date), startOfDay(new Date()));
  const dayName = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : format(date, 'EEEE');
  return `${format(date, 'MMM d')} ${'·'} ${dayName}`;
}
