import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import type { TaskWithLabels } from '@todoer/shared';
import { drainOutbox, loadOutbox, subscribeOutbox, type OutboxOp } from './outbox';

const STALE_MS = 5 * 60_000;

let started = false;

/** Wires connectivity/foreground/interval triggers that drain the outbox. Call once at app start. */
export function startSyncEngine(): void {
  if (started) return;
  started = true;

  void loadOutbox();

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void drainOutbox();
    }
  });

  const appStateSub = AppState.addEventListener('change', (next) => {
    if (next === 'active') void drainOutbox();
  });
  void appStateSub;

  setInterval(() => {
    // Skip while known offline: NetInfo's own reconnect listener above
    // already fires a drain the instant connectivity returns, so this tick
    // would otherwise just make a doomed network attempt (through a bounded
    // fetch timeout) every 30s for no benefit.
    if (onlineManager.isOnline()) void drainOutbox();
  }, 30_000);
}

// A manual pull-to-refresh has nothing to do with the outbox queue when
// there's nothing locally pending, but the header icon is the one visual
// cue this app has for "something sync-related is happening right now", so
// a pull-to-refresh flips this flag for the icon too rather than only
// relying on the RefreshControl's own spinner. Separate tiny pub/sub so
// sync.ts doesn't need to reach into outbox.ts's internals for this.
let manualRefreshing = false;
const refreshListeners = new Set<(refreshing: boolean) => void>();

function setManualRefreshing(value: boolean): void {
  manualRefreshing = value;
  for (const fn of refreshListeners) fn(manualRefreshing);
}

/**
 * Pull-to-refresh: drains any queued offline work and force-refetches the
 * core lists. Realtime keeps things current while the socket is connected,
 * but a dropped/backgrounded connection doesn't replay missed events on
 * reconnect - this is the manual catch-up for exactly that gap.
 */
export async function pullToRefresh(qc: QueryClient): Promise<void> {
  setManualRefreshing(true);
  try {
    await drainOutbox();
    await qc.refetchQueries({
      predicate: (q) =>
        ['tasks', 'tasks-completed', 'tasks-completed-since', 'projects', 'labels', 'sections'].includes(
          q.queryKey[0] as string,
        ),
    });
  } finally {
    setManualRefreshing(false);
  }
}

/** Status the sync icon renders from: visible while draining, refreshing, or stuck. */
export function useSyncStatus(): {
  visible: boolean;
  isActivelySyncing: boolean;
  oldestPendingAt: string | null;
} {
  const [snap, setSnap] = useState({ queueLength: 0, draining: false, oldestEnqueuedAt: null as string | null });
  const [refreshing, setRefreshing] = useState(manualRefreshing);
  const [, forceTick] = useState(0);

  useEffect(() => subscribeOutbox(setSnap), []);
  useEffect(() => {
    refreshListeners.add(setRefreshing);
    return () => {
      refreshListeners.delete(setRefreshing);
    };
  }, []);

  // The 5-minute staleness clause becomes true purely from time passing, not
  // from any outbox event, so it needs its own clock while something is queued.
  useEffect(() => {
    if (snap.queueLength === 0) return;
    const id = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [snap.queueLength]);

  const stale =
    snap.oldestEnqueuedAt !== null && Date.now() - Date.parse(snap.oldestEnqueuedAt) > STALE_MS;

  return {
    visible: snap.draining || refreshing || stale,
    isActivelySyncing: snap.draining || refreshing,
    oldestPendingAt: snap.oldestEnqueuedAt,
  };
}

/** The outbox's current queue, kept live for callers that merge pending rows into other state. */
export function usePendingOutboxOps(): OutboxOp[] {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  useEffect(() => subscribeOutbox((snap) => setOps(snap.ops)), []);
  return ops;
}

/**
 * Unions still-queued local rows into what the server just returned for
 * ['tasks'], local pending version winning on conflict, so a realtime
 * invalidation firing mid-queue doesn't visually wipe out a not-yet-synced
 * optimistic row before the outbox has actually pushed it.
 */
export function mergeServerWithPending(
  serverRows: TaskWithLabels[],
  pendingOps: OutboxOp[],
): TaskWithLabels[] {
  const pendingByTaskId = new Map<string, OutboxOp[]>();
  for (const op of pendingOps) {
    const list = pendingByTaskId.get(op.taskId) ?? [];
    list.push(op);
    pendingByTaskId.set(op.taskId, list);
  }
  if (pendingByTaskId.size === 0) return serverRows;

  const byId = new Map(serverRows.map((r) => [r.id, r]));
  for (const [taskId, ops] of pendingByTaskId) {
    let row = byId.get(taskId);
    for (const op of ops) {
      if (op.kind === 'create') {
        row = op.task;
      } else if (op.kind === 'edit' && row) {
        row = { ...row, ...op.patch, ...(op.labelIds ? { label_ids: op.labelIds } : {}) };
      } else if (op.kind === 'delete') {
        row = undefined;
      }
      // 'complete'/'uncomplete' recompute server-side fields (due_date roll-forward,
      // completed_at) that aren't worth mirroring locally; the optimistic cache
      // write from the mutation hook already reflects the visible effect.
    }
    if (row) byId.set(taskId, row);
    else byId.delete(taskId);
  }
  return Array.from(byId.values());
}
