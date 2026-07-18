import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeTask,
  createProject,
  createTask,
  deleteTask,
  ensureLabels,
  fetchActiveTasks,
  fetchLabels,
  fetchProjects,
  fetchSections,
  parseQuickAdd,
  uncompleteTask,
  updateTask,
  type Project,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { supabase } from './supabase';
import { playCompletionSound } from './sound';

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

export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('todoer-mobile-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () =>
        qc.invalidateQueries({ queryKey: ['tasks'] }),
      )
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
    onMutate: async (task) => {
      void playCompletionSound();
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
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUncompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => uncompleteTask(supabase, id),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
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

/** Create a task from a quick-add string (dates, p1..p4, #project, @labels). */
export function useQuickAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      defaultProjectId,
      defaultDueDate,
    }: {
      input: string;
      defaultProjectId: string;
      defaultDueDate?: string | null;
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

      return createTask(supabase, {
        content: parsed.content,
        project_id: projectId,
        priority: parsed.priority,
        due_date: parsed.due_date ?? defaultDueDate ?? null,
        due_time: parsed.due_time,
        recurrence: parsed.recurrence,
        label_ids: labels.map((l) => l.id),
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}
