'use client';

import { useEffect, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addComment,
  completeTask,
  createLabel,
  createProject,
  createSection,
  createTask,
  deleteComment,
  deleteLabel,
  deleteProject,
  deleteSection,
  deleteTask,
  ensureLabels,
  fetchActiveTasks,
  fetchComments,
  fetchCompletedSince,
  fetchCompletedTasks,
  fetchLabels,
  fetchProjects,
  fetchSections,
  parseQuickAdd,
  setTaskLabels,
  uncompleteTask,
  updateLabel,
  updateProject,
  updateSection,
  updateTask,
  type Label,
  type NewTaskInput,
  type Project,
  type Section,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { createClient } from '@/lib/supabase/client';
import { playCompletionSound } from '@/lib/sound';

export function useSupabase() {
  return useMemo(() => createClient(), []);
}

// ============================================================
// Queries
// ============================================================

export function useProjects() {
  const db = useSupabase();
  return useQuery({ queryKey: ['projects'], queryFn: () => fetchProjects(db) });
}

export function useSections() {
  const db = useSupabase();
  return useQuery({ queryKey: ['sections'], queryFn: () => fetchSections(db) });
}

export function useLabels() {
  const db = useSupabase();
  return useQuery({ queryKey: ['labels'], queryFn: () => fetchLabels(db) });
}

export function useActiveTasks() {
  const db = useSupabase();
  return useQuery({ queryKey: ['tasks'], queryFn: () => fetchActiveTasks(db) });
}

export function useCompletedTasks() {
  const db = useSupabase();
  return useQuery({ queryKey: ['tasks-completed'], queryFn: () => fetchCompletedTasks(db) });
}

export function useCompletedSince(sinceIso: string) {
  const db = useSupabase();
  return useQuery({
    queryKey: ['tasks-completed-since', sinceIso],
    queryFn: () => fetchCompletedSince(db, sinceIso),
  });
}

// ============================================================
// Realtime: any change to my rows refetches the affected caches
// ============================================================

export function useRealtimeSync() {
  const db = useSupabase();
  const qc = useQueryClient();

  useEffect(() => {
    const channel = db
      .channel('todoer-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['tasks-completed'] });
        qc.invalidateQueries({ queryKey: ['tasks-completed-since'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, () => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        qc.invalidateQueries({ queryKey: ['projects'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, () => {
        qc.invalidateQueries({ queryKey: ['sections'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, () => {
        qc.invalidateQueries({ queryKey: ['labels'] });
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [db, qc]);
}

// ============================================================
// Task mutations
// ============================================================

function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['tasks-completed'] });
  qc.invalidateQueries({ queryKey: ['tasks-completed-since'] });
}

export function useCreateTask() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewTaskInput) => createTask(db, input),
    onSettled: () => invalidateTasks(qc),
  });
}

/**
 * Create a task from a quick-add string: parses dates, priority,
 * #project and @labels, resolving names against existing data.
 */
export function useQuickAdd() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      defaultProjectId,
      sectionId,
    }: {
      input: string;
      defaultProjectId: string;
      sectionId?: string | null;
    }) => {
      const parsed = parseQuickAdd(input);
      if (!parsed.content) throw new Error('Task name is required');

      let projectId = defaultProjectId;
      if (parsed.projectName) {
        const projects = qc.getQueryData<Project[]>(['projects']) ?? (await fetchProjects(db));
        const match = projects.find(
          (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase(),
        );
        if (match) projectId = match.id;
      }

      const labels = await ensureLabels(db, parsed.labelNames);

      return createTask(db, {
        content: parsed.content,
        project_id: projectId,
        section_id: sectionId ?? null,
        priority: parsed.priority,
        due_date: parsed.due_date,
        due_time: parsed.due_time,
        recurrence: parsed.recurrence,
        label_ids: labels.map((l) => l.id),
      });
    },
    onSettled: () => {
      invalidateTasks(qc);
      qc.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

export function useCompleteTask() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => completeTask(db, task),
    onMutate: async (task) => {
      playCompletionSound();
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
      if (prev && !task.recurrence) {
        qc.setQueryData(
          ['tasks'],
          prev.filter((t) => t.id !== task.id && t.parent_id !== task.id),
        );
      }
      return { prev };
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    onSettled: () => invalidateTasks(qc),
  });
}

export function useUncompleteTask() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => uncompleteTask(db, id),
    onSettled: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => updateTask(db, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
      if (prev) {
        qc.setQueryData(
          ['tasks'],
          prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    onSettled: () => invalidateTasks(qc),
  });
}

export function useComments(taskId: string) {
  const db = useSupabase();
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => fetchComments(db, taskId),
  });
}

export function useAddComment() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      addComment(db, taskId, content),
    onSettled: (_d, _e, { taskId }) => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useDeleteComment() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; taskId: string }) => deleteComment(db, id),
    onSettled: (_d, _e, { taskId }) => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useSetTaskLabels() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ task, labelIds }: { task: Pick<Task, 'id' | 'user_id'>; labelIds: string[] }) =>
      setTaskLabels(db, task, labelIds),
    onSettled: () => invalidateTasks(qc),
  });
}

export function useDeleteTask() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(db, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<TaskWithLabels[]>(['tasks']);
      if (prev) {
        qc.setQueryData(
          ['tasks'],
          prev.filter((t) => t.id !== id && t.parent_id !== id),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tasks'], ctx.prev);
    },
    onSettled: () => invalidateTasks(qc),
  });
}

// ============================================================
// Project / section / label mutations
// ============================================================

export function useCreateProject() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string; is_favorite?: boolean }) =>
      createProject(db, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateProject>[2] }) =>
      updateProject(db, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(db, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateSection() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { project_id: string; name: string }) => createSection(db, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useUpdateSection() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; sort_order?: number } }) =>
      updateSection(db, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sections'] }),
  });
}

export function useDeleteSection() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSection(db, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['sections'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateLabel() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => createLabel(db, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useUpdateLabel() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      updateLabel(db, id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useDeleteLabel() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLabel(db, id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['labels'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export type { Label, Project, Section, Task, TaskWithLabels };
