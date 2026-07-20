/**
 * Completion milestones. Both apps count completions per local day and throw
 * a small confetti celebration when a milestone lands, so the numbers and
 * copy live here rather than drifting apart per platform.
 */

export interface Milestone {
  count: number;
  title: string;
  message: string;
}

const FIXED_MILESTONES: Milestone[] = [
  { count: 3, title: 'Three down!', message: 'You have completed 3 tasks today. Nice pace.' },
  { count: 5, title: 'On fire!', message: '5 tasks done today. You are unstoppable.' },
  { count: 8, title: 'Eight!', message: '8 tasks completed today. Keep the momentum going.' },
  { count: 10, title: 'Ten today!', message: '10 tasks in one day. Legendary.' },
];

/**
 * The milestone hit at exactly this completion count, or null. Past 10 the
 * celebration repeats every 5 tasks (15, 20, 25, ...) rather than stopping,
 * so a genuinely long day still gets acknowledged.
 */
export function completionMilestone(countToday: number): Milestone | null {
  const fixed = FIXED_MILESTONES.find((m) => m.count === countToday);
  if (fixed) return fixed;
  if (countToday > 10 && (countToday - 10) % 5 === 0) {
    return {
      count: countToday,
      title: `${countToday} tasks today!`,
      message: `You have completed ${countToday} tasks today. Incredible focus.`,
    };
  }
  return null;
}

/**
 * What one counted completion produced. Handed back by each platform's
 * recordCompletion and passed to undoCompletion if the completion turns out
 * to have failed on the server.
 */
export interface RecordedCompletion {
  /** The local day this completion was actually counted against. */
  day: string;
  /** The milestone it earned, if any. */
  milestone: Milestone | null;
  /**
   * Whether the incremented count actually reached storage. A write that
   * failed must not be undone later, or the counter drifts below the true
   * number of completions.
   */
  counted: boolean;
}

/** Show a celebration, or retract one already shown. */
export type CelebrationEvent = { milestone: Milestone } | { retract: Milestone };

const KEY_PREFIX = 'todoer.completions.';

/** Storage key holding the completion count for a given local day. */
export function completionKey(day: string): string {
  return `${KEY_PREFIX}${day}`;
}

/**
 * Reads a stored counter. Anything not a usable count (missing, corrupt, a
 * stale 'NaN' from an older write) falls back to zero rather than poisoning
 * every later read: without this a single bad value would persist as 'NaN'
 * and silently kill that day's celebrations for good.
 */
export function parseCount(raw: string | null | undefined): number {
  const n = Number(raw ?? '0');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Whether a retract should clear what is currently on screen. A retract must
 * only hide the celebration it targets, never a different one that has since
 * taken its place.
 */
export function shouldRetract(current: Milestone | null, retract: Milestone): boolean {
  return current !== null && current.count === retract.count;
}

/** Confetti palette, drawn from the app's priority and project colors. */
export const CONFETTI_COLORS = [
  '#dc4c3e',
  '#eb8909',
  '#246fe0',
  '#299438',
  '#a970ff',
  '#e05194',
  '#f2c94c',
];
