import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameYear,
  parseISO,
  startOfDay,
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

/** 'Mon 21 Jul' style heading for Upcoming view. */
export function formatDayHeading(iso: string): string {
  const date = parseISO(iso);
  const diff = differenceInCalendarDays(startOfDay(date), startOfDay(new Date()));
  const dayName = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : format(date, 'EEEE');
  return `${format(date, 'MMM d')} ${'·'} ${dayName}`;
}
