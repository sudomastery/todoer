/**
 * Turns a thrown value into copy that fits the rest of the app's voice.
 *
 * Raw exception text ("TypeError: Failed to fetch", a Postgres constraint
 * name) is written for developers, so surfacing it hands the user a string
 * that reads nothing like the interface around it. The original is logged so
 * nothing is lost from a debugging point of view.
 */
const NETWORK_HINTS = ['fetch', 'network', 'timeout', 'offline', 'connection'];

export function friendlyError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : String(e ?? '');
  if (raw) console.error(raw);

  const lower = raw.toLowerCase();
  if (NETWORK_HINTS.some((hint) => lower.includes(hint))) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return fallback;
}
