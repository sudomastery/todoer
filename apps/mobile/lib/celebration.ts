import AsyncStorage from '@react-native-async-storage/async-storage';
import { completionMilestone, todayISO, type Milestone } from '@todoer/shared';

/**
 * Counts completions per local day and fires the registered handler when a
 * milestone lands. The count survives restarts via AsyncStorage; uncompleting
 * does not decrement, which errs on the side of celebrating.
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

// All reads and writes against the counter go through this chain, so two
// completions fired close together (two different rows, each with its own
// mutation) can never interleave their read-then-write and lose an
// increment: the second call's read always happens after the first call's
// write has actually landed.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function recordCompletion(): Promise<Milestone | null> {
  return enqueue(async () => {
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
    if (milestone && handler) handler({ milestone });
    return milestone;
  });
}

/**
 * Called if the completion this counted turns out to have failed on the
 * server. Decrements the counter, and if it had shown a celebration, asks
 * the UI to retract it.
 */
export function undoCompletion(shownMilestone: Milestone | null): Promise<void> {
  return enqueue(async () => {
    const key = `${KEY_PREFIX}${todayISO()}`;
    try {
      const count = Number((await AsyncStorage.getItem(key)) ?? '0');
      await AsyncStorage.setItem(key, String(Math.max(0, count - 1)));
    } catch {
      // best effort, same as recordCompletion
    }
    if (shownMilestone && handler) handler({ retract: shownMilestone });
  });
}
