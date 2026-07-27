import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  completionKey,
  completionMilestone,
  parseCount,
  todayISO,
  type CelebrationEvent,
  type RecordedCompletion,
} from '@todoer/shared';

/**
 * Counts completions per local day and fires the registered handler when a
 * milestone lands. The count survives restarts via AsyncStorage.
 *
 * A show can be retracted if the completion that earned it turns out to have
 * failed on the server: recordCompletion hands the caller back what it
 * recorded, and undoCompletion takes that back to reverse the count and hide
 * the celebration. Deliberately unchecking a task goes through
 * reverseCompletion instead (see below), so a task completed, unchecked, and
 * completed again in the same day only ever counts once. The counting rules
 * themselves live in @todoer/shared so this and the web version cannot
 * drift apart.
 */

type Handler = (e: CelebrationEvent) => void;
let handler: Handler | null = null;

export function registerCelebrationHandler(fn: Handler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

/**
 * The celebration is decoration: a handler that throws must never take the
 * task completion down with it, since this runs inside the mutation's
 * onMutate and an escaping error would abort the completion entirely.
 */
function emit(event: CelebrationEvent): void {
  if (!handler) return;
  try {
    handler(event);
  } catch {
    // a broken celebration must not break completing a task
  }
}

// All reads and writes against the counter go through this chain, so two
// completions fired close together (two different rows, each with its own
// mutation) can never interleave their read-then-write and lose an
// increment: the second call's read always happens after the first call's
// write has actually landed. AsyncStorage is async, unlike the web's
// synchronous localStorage, which is why only this side needs it.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  // Swallowed so one failed link cannot wedge every later call behind a
  // rejected promise.
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function recordCompletion(): Promise<RecordedCompletion> {
  return enqueue(async () => {
    const day = todayISO();
    const key = completionKey(day);
    let count = 0;
    try {
      count = parseCount(await AsyncStorage.getItem(key));
    } catch {
      // storage hiccups should never break completing a task
    }
    const next = count + 1;
    let counted = false;
    try {
      await AsyncStorage.setItem(key, String(next));
      counted = true;
    } catch {
      // same: celebration is best effort, and an unwritten count must not be
      // undone later
    }
    const milestone = completionMilestone(next);
    if (milestone) emit({ milestone });
    return { day, milestone, counted };
  });
}

/**
 * Called if the completion this counted turns out to have failed on the
 * server. Decrements the counter for the day it was actually recorded
 * against, not "today" (recomputing the day here would decrement the wrong
 * one if the completion and its failure straddle local midnight), and only
 * if that increment actually reached storage. If it had shown a
 * celebration, also asks the UI to retract it.
 */
export function undoCompletion(recorded: RecordedCompletion | null): Promise<void> {
  if (!recorded) return Promise.resolve();
  const { day, milestone, counted } = recorded;
  return enqueue(async () => {
    if (counted) {
      const key = completionKey(day);
      try {
        const count = parseCount(await AsyncStorage.getItem(key));
        await AsyncStorage.setItem(key, String(Math.max(0, count - 1)));
      } catch {
        // best effort, same as recordCompletion
      }
    }
    if (milestone) emit({ retract: milestone });
  });
}

/**
 * Called when a task is deliberately unchecked (as opposed to undoCompletion,
 * which only fires when the completion itself failed on the server). Without
 * this, completing a task, unchecking it, and completing it again would count
 * as two completions for a single task - exactly the "streak inflation" this
 * exists to prevent. Decrements the day the task was actually completed on
 * (from its completed_at, not "today"), so unchecking something completed
 * yesterday corrects yesterday's count rather than today's.
 */
export function reverseCompletion(day: string): Promise<void> {
  return enqueue(async () => {
    const key = completionKey(day);
    let count = 0;
    try {
      count = parseCount(await AsyncStorage.getItem(key));
    } catch {
      return;
    }
    if (count === 0) return;
    try {
      await AsyncStorage.setItem(key, String(count - 1));
    } catch {
      return;
    }
    // Only "today" can have a celebration currently on screen to retract -
    // unchecking something completed on an earlier day has nothing to hide.
    if (day !== todayISO()) return;
    const milestone = completionMilestone(count);
    if (milestone) emit({ retract: milestone });
  });
}
