import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import {
  DEFAULT_NOTIFICATION_PREFS,
  digestBody,
  dueReminders,
  NOTIFICATION_PREF_KEY,
  parseNotificationPrefs,
  type NotificationPrefs,
  type Task,
} from '@todoer/shared';

/** Cap on scheduled reminders; Android limits how many alarms an app may hold. */
const MAX_REMINDERS = 40;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  return parseNotificationPrefs(await AsyncStorage.getItem(NOTIFICATION_PREF_KEY));
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, JSON.stringify(prefs));
}

/** Asks for permission the first time reminders are switched on. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Rebuilds every scheduled notification from the current tasks and prefs.
 * Cheap enough to run whenever the task list changes: Expo has no way to update
 * a single scheduled notification, so the whole set is replaced.
 */
export async function rescheduleAll(tasks: Task[]): Promise<void> {
  const prefs = await getNotificationPrefs();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  for (const reminder of dueReminders(tasks, prefs).slice(0, MAX_REMINDERS)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: reminder.title, body: reminder.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.at,
      },
    });
  }

  if (prefs.dailyDigest) {
    const body = digestBody(tasks, format(new Date(), 'yyyy-MM-dd'));
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Today in Todoer', body: body ?? 'Nothing due today. Enjoy it.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.digestHour,
        minute: 0,
      },
    });
  }
}
