import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  completeTask,
  createTask,
  deleteTask,
  setTaskLabels,
  uncompleteTask,
  updateTask,
  type NewTaskInput,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { getCachedUserId, supabase } from './supabase';

/**
 * A locally-queued task mutation waiting to reach Supabase. Entries carry
 * everything their eventual network call needs, so draining never has to go
 * back to a UI layer that may no longer exist.
 */
export type OutboxOp =
  | {
      kind: 'create';
      id: string;
      taskId: string;
      enqueuedAt: string;
      input: NewTaskInput;
      /** The optimistic row, so a restart can reconstruct the cache without
       * a network round trip before this entry has drained. */
      task: TaskWithLabels;
    }
  | {
      kind: 'edit';
      id: string;
      taskId: string;
      enqueuedAt: string;
      userId: string;
      patch: UpdateTaskInput;
      labelIds?: string[];
    }
  | { kind: 'complete'; id: string; taskId: string; enqueuedAt: string; task: Task }
  | { kind: 'uncomplete'; id: string; taskId: string; enqueuedAt: string }
  | { kind: 'delete'; id: string; taskId: string; enqueuedAt: string };

export interface OutboxSnapshot {
  queueLength: number;
  draining: boolean;
  oldestEnqueuedAt: string | null;
  /** Shallow copy of the queue, for callers that need to merge pending rows
   * into other state (e.g. the tasks cache) rather than just show a count. */
  ops: OutboxOp[];
}

const STORAGE_KEY = '@todoer/outbox';

let queue: OutboxOp[] = [];
let loaded = false;
let draining = false;

type Listener = (snapshot: OutboxSnapshot) => void;
const listeners = new Set<Listener>();

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

function snapshot(): OutboxSnapshot {
  return {
    queueLength: queue.length,
    draining,
    oldestEnqueuedAt: queue.length > 0 ? queue[0].enqueuedAt : null,
    ops: queue.slice(),
  };
}

function notify(): void {
  const s = snapshot();
  for (const fn of listeners) fn(s);
}

// All reads/writes against the persisted queue go through this chain, same
// pattern as celebration.ts, so a push racing a drain's shift can never
// interleave their read-then-write and corrupt the stored array.
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(fn);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // best effort: a failed persist just means a force-quit could lose the
    // queue, no worse than not having this feature at all
  }
}

/** Loads the persisted queue once, then attempts to drain it. Call at app start. */
export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  loaded = true;
  await serialize(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as OutboxOp[]) : [];
      // A push() can land synchronously (queue.push) while this await is in
      // flight, before storage has even been read. Prepending the persisted
      // ops rather than overwriting `queue` keeps that entry instead of
      // silently discarding it - both from memory and, once persist() below
      // runs next in the chain, from disk too.
      const alreadyQueued = new Set(queue.map((op) => op.id));
      queue = [...stored.filter((op) => !alreadyQueued.has(op.id)), ...queue];
    } catch {
      // keep whatever's already in memory from any push() that beat this load
    }
    notify();
  });
  void drainOutbox();
}

export function push(op: OutboxOp): void {
  queue.push(op);
  notify();
  void serialize(persist);
  void drainOutbox();
}

function isAuthOrValidationError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Postgrest/PostgREST error messages for RLS and constraint violations;
  // these will never succeed on retry, unlike a network blip.
  return /row-level security|permission denied|violates|JWT|not authorized/i.test(message);
}

async function runOp(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'create':
      await createTask(supabase, op.input);
      return;
    case 'edit':
      await updateTask(supabase, op.taskId, op.patch);
      if (op.labelIds) {
        // The cache may have populated since this entry was pushed - prefer
        // it fresh, but fall back to what was baked in at push time. If
        // neither is available yet, throw (not an auth/validation error, so
        // drainOutbox retries later) rather than send an empty user_id.
        const userId = getCachedUserId() || op.userId;
        if (!userId) throw new Error('no cached user id yet, will retry');
        await setTaskLabels(supabase, { id: op.taskId, user_id: userId }, op.labelIds);
      }
      return;
    case 'complete':
      await completeTask(supabase, op.task);
      return;
    case 'uncomplete':
      await uncompleteTask(supabase, op.taskId);
      return;
    case 'delete':
      await deleteTask(supabase, op.taskId);
      return;
  }
}

/**
 * Drains the queue strictly in order, one entry at a time. A failure stops
 * draining rather than skipping ahead, since a later entry may depend on the
 * one that just failed (e.g. an edit queued after a create for the same
 * not-yet-synced task).
 */
export async function drainOutbox(): Promise<void> {
  if (draining) return;
  draining = true;
  notify();
  try {
    while (queue.length > 0) {
      const op = queue[0];
      try {
        await runOp(op);
      } catch (err) {
        if (isAuthOrValidationError(err)) {
          // This entry can never succeed as-is; drop it rather than wedge
          // every later entry behind it forever.
          queue.shift();
          if (op.kind === 'create') {
            // Any later edit/complete/uncomplete/delete queued for this same
            // task id targets a row that will now never exist server-side -
            // draining them would either silently no-op or error forever.
            queue = queue.filter((o) => o.taskId !== op.taskId);
          }
          await serialize(persist);
          notify();
          continue;
        }
        break;
      }
      queue.shift();
      await serialize(persist);
      notify();
    }
  } finally {
    draining = false;
    notify();
  }
}
