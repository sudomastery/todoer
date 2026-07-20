import AsyncStorage from '@react-native-async-storage/async-storage';
import { completionMilestone, todayISO, type Milestone } from '@todoer/shared';

/**
 * Counts completions per local day and fires the registered handler when a
 * milestone lands. The count survives restarts via AsyncStorage; uncompleting
 * does not decrement, which errs on the side of celebrating.
 */

type Handler = (m: Milestone) => void;
let handler: Handler | null = null;

export function registerCelebrationHandler(fn: Handler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

const KEY_PREFIX = 'todoer.completions.';

export async function recordCompletion(): Promise<void> {
  const key = `${KEY_PREFIX}${todayISO()}`;
  let count = 0;
  try {
    count = Number((await AsyncStorage.getItem(key)) ?? '0');
  } catch {
    // storage hiccups should never break completing a task
  }
  const next = count + 1;
  try {
    await AsyncStorage.setItem(key, String(next));
  } catch {
    // same: celebration is best effort
  }
  const milestone = completionMilestone(next);
  if (milestone && handler) handler(milestone);
}

/** Called if the completion this counted turns out to have failed on the server. */
export async function undoCompletion(): Promise<void> {
  const key = `${KEY_PREFIX}${todayISO()}`;
  try {
    const count = Number((await AsyncStorage.getItem(key)) ?? '0');
    await AsyncStorage.setItem(key, String(Math.max(0, count - 1)));
  } catch {
    // best effort, same as recordCompletion
  }
}
