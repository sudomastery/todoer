import {
  DEFAULT_NOTIFICATION_PREFS,
  digestBody,
  dueReminders,
  NOTIFICATION_PREF_KEY,
  parseNotificationPrefs,
  type NotificationPrefs,
  type Task,
} from '@todoer/shared';

const SENT_KEY = 'todoer.notifications.sent';
const DIGEST_KEY = 'todoer.notifications.digest';

export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_NOTIFICATION_PREFS };
  return parseNotificationPrefs(window.localStorage.getItem(NOTIFICATION_PREF_KEY));
}

export function setNotificationPrefs(prefs: NotificationPrefs): void {
  window.localStorage.setItem(NOTIFICATION_PREF_KEY, JSON.stringify(prefs));
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Reminders already delivered, so a reload does not fire them again. */
function sent(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function markSent(taskId: string, at: Date): void {
  const all = sent();
  all[taskId] = at.toISOString();
  window.localStorage.setItem(SENT_KEY, JSON.stringify(all));
}

function show(title: string, body: string): void {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico', tag: title });
}

/**
 * Fires any reminder that has come due, plus the daily summary once per day.
 * The browser can only do this while a tab is open, so this runs on a timer
 * from the app shell rather than being scheduled ahead of time.
 */
export function runNotificationTick(tasks: Task[], now: Date = new Date()): void {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !notificationsSupported()) return;

  // dueReminders only returns future reminders, so look back a little to catch
  // the ones that came due between ticks.
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const delivered = sent();
  for (const reminder of dueReminders(tasks, prefs, windowStart)) {
    if (reminder.at > now) continue;
    if (delivered[reminder.taskId] === reminder.at.toISOString()) continue;
    show(reminder.title, reminder.body);
    markSent(reminder.taskId, reminder.at);
  }

  if (prefs.dailyDigest && now.getHours() >= prefs.digestHour) {
    const today = now.toISOString().slice(0, 10);
    if (window.localStorage.getItem(DIGEST_KEY) !== today) {
      const body = digestBody(tasks, today);
      if (body) show('Today in Todoer', body);
      window.localStorage.setItem(DIGEST_KEY, today);
    }
  }
}
