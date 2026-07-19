import type { Task } from './types';

/**
 * Reminder preferences, stored as JSON under NOTIFICATION_PREF_KEY in
 * localStorage on the web and AsyncStorage on mobile.
 */
export interface NotificationPrefs {
  /** Master switch; when off nothing is scheduled on either platform. */
  enabled: boolean;
  /** Remind about tasks that have a due time. */
  dueReminders: boolean;
  /** How many minutes before the due time the reminder fires. */
  leadMinutes: number;
  /** One summary of everything due today. */
  dailyDigest: boolean;
  /** Hour of day (0-23) the digest is sent. */
  digestHour: number;
}

export const NOTIFICATION_PREF_KEY = 'todoer.notifications';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  dueReminders: true,
  leadMinutes: 10,
  dailyDigest: true,
  digestHour: 9,
};

export const LEAD_OPTIONS = [0, 5, 10, 30, 60] as const;

export function parseNotificationPrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export interface Reminder {
  taskId: string;
  title: string;
  body: string;
  at: Date;
}

/**
 * Reminders to schedule for the given tasks: one per task that has a due time,
 * fired `leadMinutes` early. Tasks already past their reminder moment are
 * skipped, as are completed tasks and all-day tasks (the digest covers those).
 */
export function dueReminders(
  tasks: Task[],
  prefs: NotificationPrefs,
  now: Date = new Date(),
): Reminder[] {
  if (!prefs.enabled || !prefs.dueReminders) return [];
  const out: Reminder[] = [];
  for (const task of tasks) {
    if (task.is_completed || !task.due_date || !task.due_time) continue;
    const at = new Date(`${task.due_date}T${task.due_time}`);
    if (Number.isNaN(at.getTime())) continue;
    at.setMinutes(at.getMinutes() - prefs.leadMinutes);
    if (at.getTime() <= now.getTime()) continue;
    out.push({
      taskId: task.id,
      title: task.content,
      body: prefs.leadMinutes > 0 ? `Due in ${prefs.leadMinutes} minutes` : 'Due now',
      at,
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Text for the daily digest, or null when nothing is due. */
export function digestBody(tasks: Task[], today: string): string | null {
  const due = tasks.filter((t) => !t.is_completed && t.due_date && t.due_date <= today);
  if (due.length === 0) return null;
  const names = due.slice(0, 3).map((t) => t.content);
  const rest = due.length - names.length;
  const list = names.join(', ') + (rest > 0 ? ` and ${rest} more` : '');
  return `${due.length} task${due.length === 1 ? '' : 's'} due today: ${list}`;
}
