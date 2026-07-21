import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment,
  completeTask,
  createLabel,
  createProject,
  createSection,
  createTask,
  createSubtasks,
  deleteComment,
  deleteLabel,
  deleteSection,
  deleteTask,
  ensureLabels,
  fetchActiveTasks,
  fetchComments,
  fetchCompletedSince,
  fetchCompletedTasks,
  fetchLabels,
  fetchProfile,
  fetchProjects,
  fetchSections,
  parseQuickAdd,
  setTaskLabels,
  uncompleteTask,
  updateLabel,
  updateProject,
  updateSection,
  deleteProject,
  reorderTasks,
  updateTask,
  type Priority,
  type Project,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { supabase } from './supabase';
import { recordCompletion, undoCompletion } from './celebration';
import { playCompletionSound } from './sound';

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
  return useQuery({ queryKey: ['tasks'], queryFn: () => fetchActiveTasks(supabase) });
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
    mutationFn: (task: Task) => completeTask(supabase, task),
    // Fired here rather than onSuccess: completing a task removes its row
    // from the list optimistically below, which unmounts it before the
    // network call resolves, and a hook level onSuccess is not guaranteed to
    // run once the component that registered it is gone. Verified on the
    // emulator: milestones landed inconsistently until this moved.
    onMutate: async (task) => {
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
    mutationFn: (id: string) => uncompleteTask(supabase, id),
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
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) =>
      updateTask(supabase, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(supabase, id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
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

export function useSetTaskLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, labelIds }: { task: Pick<Task, 'id' | 'user_id'>; labelIds: string[] }) =>
      setTaskLabels(supabase, task, labelIds),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

/** Adds a batch of children under a task that was just created. */
export function useCreateSubtasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parent, names }: { parent: Task; names: string[] }) =>
      createSubtasks(supabase, parent, names),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
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

      let projectId = defaultProjectId;
      if (parsed.projectName) {
        const projects = qc.getQueryData<Project[]>(['projects']) ?? (await fetchProjects(supabase));
        const match = projects.find(
          (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (match) projectId = match.id;
      }

      const labels = await ensureLabels(supabase, parsed.labelNames);

      const dueDate =
        overrides?.due_date !== undefined
          ? overrides.due_date
          : (parsed.due_date ?? defaultDueDate ?? null);
      const dueTime =
        overrides?.due_time !== undefined ? overrides.due_time : parsed.due_time;

      return createTask(supabase, {
        content: parsed.content,
        project_id: projectId,
        parent_id: parentId ?? null,
        priority: overrides?.priority ?? parsed.priority,
        due_date: dueDate,
        // A time with no day would never fire.
        due_time: dueDate ? dueTime : null,
        recurrence:
          overrides?.recurrence !== undefined ? overrides.recurrence : parsed.recurrence,
        label_ids: labels.map((l) => l.id),
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}
