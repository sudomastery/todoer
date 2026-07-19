import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addComment,
  completeTask,
  createLabel,
  createProject,
  createSection,
  createTask,
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
  updateTask,
  type Project,
  type Task,
  type TaskWithLabels,
  type UpdateTaskInput,
} from '@todoer/shared';
import { supabase } from './supabase';
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

/** Create a task from a quick-add string (dates, p1..p4, #project, @labels). */
export function useQuickAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      defaultProjectId,
      defaultDueDate,
      parentId,
    }: {
      input: string;
      defaultProjectId: string;
      defaultDueDate?: string | null;
      parentId?: string | null;
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
        parent_id: parentId ?? null,
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
