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
