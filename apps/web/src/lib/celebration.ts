import { completionMilestone, todayISO, type Milestone } from '@todoer/shared';

/**
 * Counts completions per local day and fires the registered handler when a
 * milestone lands. Mirrors the mobile implementation; localStorage keeps the
 * count across reloads, and uncompleting does not decrement.
 *
 * A show can be retracted if the completion that earned it turns out to have
 * failed on the server: recordCompletion hands the caller back the milestone
 * it fired (if any), and undoCompletion takes that back to tell the UI to
 * hide it, but only if it is still the one on screen (a retract must never
 * clobber a different, later milestone that fired in the meantime).
 */

export type CelebrationEvent = { milestone: Milestone } | { retract: Milestone };
type Handler = (e: CelebrationEvent) => void;
let handler: Handler | null = null;

export function registerCelebrationHandler(fn: Handler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

const KEY_PREFIX = 'todoer.completions.';

export function recordCompletion(): Milestone | null {
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
  if (milestone && handler) handler({ milestone });
  return milestone;
}

/**
 * Called if the completion this counted turns out to have failed on the
 * server. Decrements the counter, and if it had shown a celebration, asks
 * the UI to retract it.
 */
export function undoCompletion(shownMilestone: Milestone | null): void {
  const key = `${KEY_PREFIX}${todayISO()}`;
  try {
    const count = Number(localStorage.getItem(key) ?? '0');
    localStorage.setItem(key, String(Math.max(0, count - 1)));
  } catch {
    // best effort, same as recordCompletion
  }
  if (shownMilestone && handler) handler({ retract: shownMilestone });
}
