import { completionMilestone, todayISO, type Milestone } from '@todoer/shared';

/**
 * Counts completions per local day and fires the registered handler when a
 * milestone lands. Mirrors the mobile implementation; localStorage keeps the
 * count across reloads, and uncompleting does not decrement.
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

export function recordCompletion(): void {
  const key = `${KEY_PREFIX}${todayISO()}`;
  let count = 0;
  try {
    count = Number(localStorage.getItem(key) ?? '0');
  } catch {
    // storage being unavailable should never break completing a task
  }
  const next = count + 1;
  try {
    localStorage.setItem(key, String(next));
  } catch {
    // same: celebration is best effort
  }
  const milestone = completionMilestone(next);
  if (milestone && handler) handler(milestone);
}

/** Called if the completion this counted turns out to have failed on the server. */
export function undoCompletion(): void {
  const key = `${KEY_PREFIX}${todayISO()}`;
  try {
    const count = Number(localStorage.getItem(key) ?? '0');
    localStorage.setItem(key, String(Math.max(0, count - 1)));
  } catch {
    // best effort, same as recordCompletion
  }
}
