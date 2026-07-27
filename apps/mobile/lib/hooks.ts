import { useEffect } from 'react';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  addComment,
  createLabel,
  createProject,
  createSection,
  deleteComment,
  deleteLabel,
  deleteSection,
  ensureLabels,
  ensureProjects,
  fetchActiveTasks,
  fetchComments,
  fetchCompletedSince,
  fetchCompletedTasks,
  fetchLabels,
  fetchProfile,
  fetchProjects,
  fetchSections,
  parseQuickAdd,
  updateLabel,
  updateProject,
  updateSection,
  deleteProject,
  reorderTasks,
  type Label,
  type NewTaskInput,
  type Priority,
  type Project,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { getCachedUserId, supabase } from './supabase';
import { recordCompletion, reverseCompletion, undoCompletion } from './celebration';
import { playCompletionSound } from './sound';
import { push as pushOutbox } from './outbox';
import { mergeServerWithPending, usePendingOutboxOps } from './sync';

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: () => fetchProfile(supabase) });
}

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => fetchProjects(supabase) });
}

export function useSections() {
  return useQuery({ queryKey: ['sections'], queryFn: () => fetchSections(supabase) });
}

export function useLabels() {
  return useQuery({ queryKey: ['labels'], queryFn: () => fetchLabels(supabase) });
}

export function useActiveTasks() {
  const pending = usePendingOutboxOps();
  return useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchActiveTasks(supabase),
    select: (rows) => mergeServerWithPending(rows, pending),
  });
}

export function useCompletedTasks() {
  return useQuery({ queryKey: ['tasks-completed'], queryFn: () => fetchCompletedTasks(supabase) });
}

export function useCompletedSince(sinceIso: string) {
  return useQuery({
    queryKey: ['tasks-completed-since', sinceIso],
    queryFn: () => fetchCompletedSince(supabase, sinceIso),
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => fetchComments(supabase, taskId),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      addComment(supabase, taskId, content),
    onSettled: (_d, _e, { taskId }) => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; taskId: string }) => deleteComment(supabase, id),
    onSettled: (_d, _e, { taskId }) => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('todoer-mobile-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['tasks-completed'] });
        qc.invalidateQueries({ queryKey: ['tasks-completed-since'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, () =>
        qc.invalidateQueries({ queryKey: ['tasks'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () =>
        qc.invalidateQueries({ queryKey: ['projects'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () =>
        qc.invalidateQueries({ queryKey: ['sections'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, () =>
        qc.invalidateQueries({ queryKey: ['labels'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    // The network call happens later, in the outbox's drain loop, not here:
    // this hook only needs to record the completion locally and queue it.
    mutationFn: async () => {},
    // Fired here rather than onSuccess: completing a task removes its row
    // from the list optimistically below, which unmounts it before the
    // network call resolves, and a hook level onSuccess is not guaranteed to
    // run once the component that registered it is gone. Verified on the
    // emulator: milestones landed inconsistently until this moved.
    onMutate: async (task: Task) => {
      void playCompletionSound();
      // Awaited so a failed completion can retract exactly the milestone it
      // showed, and so two completions fired close together are serialized
      // through the same counter write rather than racing each other.
      const recorded = await recordCompletion();
      // Everything after the count is best effort. If a cache call throws,
      // onMutate must still return the context, otherwise TanStack Query
      // hands onError an undefined context and the completion just counted
      // can never be undone or retracted.
      let prev: TaskWithLabels[] | undefined;
      try {
        await qc.cancelQueries({ queryKey: ['tasks'] });
        prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
        if (prev && !task.recurrence) {
          qc.setQueryData(
            ['tasks'],
            prev.filter((t) => t.id !== task.id && t.parent_id !== task.id),
          );
        }
      } catch {
        // the completion itself still goes ahead; only the optimistic
        // list update is skipped
      }
      pushOutbox({
        kind: 'complete',
        id: Crypto.randomUUID(),
        taskId: task.id,
        enqueuedAt: new Date().toISOString(),
        task,
      });
      return { prev, recorded };
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
      void undoCompletion(ctx?.recorded ?? null);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks-completed'] });
      qc.invalidateQueries({ queryKey: ['tasks-completed-since'] });
    },
  });
}

export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {},
    onMutate: async (id: string) => {
      let prevActive: TaskWithLabels[] | undefined;
      let prevCompleted: TaskWithLabels[] | undefined;
      try {
        await qc.cancelQueries({ queryKey: ['tasks-completed'] });
        prevCompleted = qc.getQueryData<TaskWithLabels[]>(['tasks-completed']);
        const task = prevCompleted?.find((t) => t.id === id);
        if (task) {
          // Deliberately unchecking, not a failed mutation: correct whichever
          // day this task's completion was actually counted against, so
          // completing it again today doesn't count as a second completion.
          if (task.completed_at) void reverseCompletion(task.completed_at.slice(0, 10));
          await qc.cancelQueries({ queryKey: ['tasks'] });
          prevActive = qc.getQueryData<TaskWithLabels[]>(['tasks']);
          qc.setQueryData<TaskWithLabels[]>(['tasks'], (prev) =>
            prev ? [{ ...task, is_completed: false, completed_at: null }, ...prev] : prev,
          );
          qc.setQueryData(
            ['tasks-completed'],
            prevCompleted!.filter((t) => t.id !== id),
          );
        }
      } catch {
        // the uncomplete itself still goes ahead; only the optimistic move is skipped
      }
      pushOutbox({
        kind: 'uncomplete',
        id: Crypto.randomUUID(),
        taskId: id,
        enqueuedAt: new Date().toISOString(),
      });
      return { prevActive, prevCompleted };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prevActive) qc.setQueryData(['tasks'], ctx.prevActive);
      if (ctx?.prevCompleted) qc.setQueryData(['tasks-completed'], ctx.prevCompleted);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks-completed'] });
      qc.invalidateQueries({ queryKey: ['tasks-completed-since'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {},
    onMutate: async ({
      id,
      patch,
      labelIds,
    }: {
      id: string;
      patch: UpdateTaskInput;
      /** Also updates the task's labels as one atomic queued edit, matching
       * how TaskEditSheet saves fields and labels together. */
      labelIds?: string[];
    }) => {
      let prev: TaskWithLabels[] | undefined;
      try {
        await qc.cancelQueries({ queryKey: ['tasks'] });
        prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
        if (prev) {
          qc.setQueryData<TaskWithLabels[]>(
            ['tasks'],
            prev.map((t) =>
              t.id === id ? { ...t, ...patch, ...(labelIds ? { label_ids: labelIds } : {}) } : t,
            ),
          );
        }
      } catch {
        // the edit itself still goes ahead; only the optimistic write is skipped
      }
      pushOutbox({
        kind: 'edit',
        id: Crypto.randomUUID(),
        taskId: id,
        enqueuedAt: new Date().toISOString(),
        userId: getCachedUserId() ?? '',
        patch,
        labelIds,
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    // Not returned: invalidateQueries' promise only resolves once its refetch
    // settles, and offline that refetch can hang for many seconds trying (and
    // failing) to reach the network. mutateAsync awaits whatever onSettled
    // returns, so returning it here would leave the calling sheet's `await
    // updateTask.mutateAsync(...)` - and the UI it gates, like closing the
    // sheet - stuck for that entire hang.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      reorderTasks(supabase, updates),
    // Written straight into the cache so the dropped row holds its new place
    // rather than springing back while the updates are in flight.
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
      if (prev) {
        const next = new Map(updates.map((u) => [u.id, u.sort_order]));
        qc.setQueryData(
          ['tasks'],
          prev.map((t) => (next.has(t.id) ? { ...t, sort_order: next.get(t.id)! } : t)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    // See useUpdateTask's onSettled for why this isn't returned.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {},
    onMutate: async (id: string) => {
      let prev: TaskWithLabels[] | undefined;
      try {
        await qc.cancelQueries({ queryKey: ['tasks'] });
        prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
        if (prev) {
          qc.setQueryData(
            ['tasks'],
            prev.filter((t) => t.id !== id && t.parent_id !== id),
          );
        }
      } catch {
        // the delete itself still goes ahead; only the optimistic removal is skipped
      }
      pushOutbox({ kind: 'delete', id: Crypto.randomUUID(), taskId: id, enqueuedAt: new Date().toISOString() });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    // See useUpdateTask's onSettled for why this isn't returned.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) => createProject(supabase, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Project, 'name' | 'color' | 'is_favorite' | 'is_archived'>> }) =>
      updateProject(supabase, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(supabase, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => createLabel(supabase, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useUpdateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      updateLabel(supabase, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLabel(supabase, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['labels'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { project_id: string; name: string }) => createSection(supabase, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; sort_order?: number } }) =>
      updateSection(supabase, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSection(supabase, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['sections'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Adds a batch of children under a task that was just created. */
export function useCreateSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parent, names }: { parent: Task; names: string[] }) => {
      let cursor = Date.now();
      const created: TaskWithLabels[] = [];
      for (const name of names) {
        const content = name.trim();
        if (!content) continue;
        const id = Crypto.randomUUID();
        // Distinct timestamps, in submission order, so a restart's
        // reconstructed queue preserves the order subtasks were typed in.
        const nowIso = new Date(cursor++).toISOString();
        const input: NewTaskInput = {
          id,
          content,
          project_id: parent.project_id,
          section_id: parent.section_id,
          parent_id: parent.id,
        };
        const task: TaskWithLabels = {
          id,
          user_id: parent.user_id,
          project_id: parent.project_id,
          section_id: parent.section_id,
          parent_id: parent.id,
          content,
          description: '',
          priority: 4,
          due_date: null,
          due_time: null,
          recurrence: null,
          is_completed: false,
          completed_at: null,
          sort_order: 0,
          created_at: nowIso,
          updated_at: nowIso,
          label_ids: [],
        };
        created.push(task);
        pushOutbox({ kind: 'create', id: Crypto.randomUUID(), taskId: id, enqueuedAt: nowIso, input, task });
      }
      if (created.length > 0) {
        qc.setQueryData<TaskWithLabels[]>(['tasks'], (prev) => (prev ? [...created, ...prev] : created));
      }
    },
    // See useUpdateTask's onSettled for why this isn't returned. This one
    // matters most: AddTaskSheet always awaits this mutation after quick-add,
    // even with zero subtasks typed, so a hung invalidation here blocked the
    // sheet from closing on every offline submission.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/** Create a task from a quick-add string (dates, p1..p4, #project, @labels). */
export function useQuickAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      defaultProjectId,
      defaultDueDate,
      parentId,
      overrides,
    }: {
      input: string;
      defaultProjectId: string;
      defaultDueDate?: string | null;
      parentId?: string | null;
      /** Explicit picker choices, which win over tokens parsed from the text. */
      overrides?: {
        due_date?: string | null;
        due_time?: string | null;
        recurrence?: string | null;
        priority?: Priority;
      };
    }) => {
      const parsed = parseQuickAdd(input);
      if (!parsed.content) throw new Error('Task name is required');

      // onlineManager mirrors NetInfo through a live listener (wired in
      // app/_layout.tsx), so it's already current. A fresh NetInfo.fetch()
      // here instead can return a stale "connected" reading for a moment
      // right after the radio actually drops, which sent ensureLabels/
      // fetchProjects below on a real, multi-second network attempt while
      // offline - exactly what this whole online check exists to prevent.
      const online = onlineManager.isOnline();

      let projectId = defaultProjectId;
      if (parsed.projectName) {
        const cachedProjects = qc.getQueryData<Project[]>(['projects']) ?? [];
        const projects = cachedProjects.length > 0 || !online ? cachedProjects : await fetchProjects(supabase);
        const match = projects.find(
          (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (match) {
          projectId = match.id;
        } else if (online) {
          // A #project token works like an @label one: an unrecognized name
          // mints a new project. Needs the network, same as ensureLabels
          // below - offline, it falls back to the default project instead.
          try {
            projectId = (await ensureProjects(supabase, [parsed.projectName]))[0].id;
          } catch {
            // keep the default project rather than fail the whole task
          }
        }
      }

      // ensureLabels can create a brand new label, which needs the network;
      // offline, fall back to matching only labels already in cache so
      // creating the task itself is never blocked on connectivity.
      const cachedLabels = qc.getQueryData<Label[]>(['labels']) ?? [];
      let labelIds: string[];
      if (online) {
        try {
          labelIds = (await ensureLabels(supabase, parsed.labelNames)).map((l) => l.id);
        } catch {
          labelIds = cachedLabels
            .filter((l) => parsed.labelNames.some((n) => n.toLowerCase() === l.name.toLowerCase()))
            .map((l) => l.id);
        }
      } else {
        labelIds = cachedLabels
          .filter((l) => parsed.labelNames.some((n) => n.toLowerCase() === l.name.toLowerCase()))
          .map((l) => l.id);
      }

      const dueDate =
        overrides?.due_date !== undefined
          ? overrides.due_date
          : (parsed.due_date ?? defaultDueDate ?? null);
      const dueTime =
        overrides?.due_time !== undefined ? overrides.due_time : parsed.due_time;
      const priority = overrides?.priority ?? parsed.priority;
      const recurrence =
        overrides?.recurrence !== undefined ? overrides.recurrence : parsed.recurrence;

      const id = Crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const taskInput: NewTaskInput = {
        id,
        content: parsed.content,
        project_id: projectId,
        parent_id: parentId ?? null,
        priority,
        due_date: dueDate,
        // A time with no day would never fire.
        due_time: dueDate ? dueTime : null,
        recurrence,
        label_ids: labelIds,
      };
      const optimistic: TaskWithLabels = {
        id,
        user_id: getCachedUserId() ?? '',
        project_id: projectId,
        section_id: null,
        parent_id: parentId ?? null,
        content: parsed.content,
        description: '',
        priority,
        due_date: dueDate,
        due_time: dueDate ? (dueTime ?? null) : null,
        recurrence: recurrence ?? null,
        is_completed: false,
        completed_at: null,
        sort_order: 0,
        created_at: nowIso,
        updated_at: nowIso,
        label_ids: labelIds,
      };

      qc.setQueryData<TaskWithLabels[]>(['tasks'], (prev) => (prev ? [optimistic, ...prev] : [optimistic]));
      pushOutbox({ kind: 'create', id: Crypto.randomUUID(), taskId: id, enqueuedAt: nowIso, input: taskInput, task: optimistic });

      return optimistic;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['labels'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
