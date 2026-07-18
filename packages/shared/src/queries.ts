import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Label,
  NewTaskInput,
  Priority,
  Project,
  Section,
  Task,
  TaskWithLabels,
  UpdateTaskInput,
} from './types';
import { nextOccurrence } from './recurrence';

type Client = SupabaseClient;

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ============================================================
// Projects
// ============================================================

export async function fetchProjects(db: Client): Promise<Project[]> {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('is_archived', false)
    .order('is_inbox', { ascending: false })
    .order('sort_order')
    .order('created_at');
  throwIf(error);
  return (data ?? []) as Project[];
}

export async function createProject(
  db: Client,
  input: { name: string; color: string; is_favorite?: boolean },
): Promise<Project> {
  const { data: auth } = await db.auth.getUser();
  const { data, error } = await db
    .from('projects')
    .insert({ ...input, user_id: auth.user?.id })
    .select()
    .single();
  throwIf(error);
  return data as Project;
}

export async function updateProject(
  db: Client,
  id: string,
  patch: Partial<Pick<Project, 'name' | 'color' | 'is_favorite' | 'is_archived' | 'sort_order'>>,
): Promise<void> {
  const { error } = await db.from('projects').update(patch).eq('id', id);
  throwIf(error);
}

export async function deleteProject(db: Client, id: string): Promise<void> {
  const { error } = await db.from('projects').delete().eq('id', id).eq('is_inbox', false);
  throwIf(error);
}

// ============================================================
// Sections
// ============================================================

export async function fetchSections(db: Client): Promise<Section[]> {
  const { data, error } = await db.from('sections').select('*').order('sort_order').order('created_at');
  throwIf(error);
  return (data ?? []) as Section[];
}

export async function createSection(db: Client, input: { project_id: string; name: string }): Promise<Section> {
  const { data: auth } = await db.auth.getUser();
  const { data, error } = await db
    .from('sections')
    .insert({ ...input, user_id: auth.user?.id })
    .select()
    .single();
  throwIf(error);
  return data as Section;
}

export async function updateSection(db: Client, id: string, patch: { name?: string; sort_order?: number }): Promise<void> {
  const { error } = await db.from('sections').update(patch).eq('id', id);
  throwIf(error);
}

export async function deleteSection(db: Client, id: string): Promise<void> {
  const { error } = await db.from('sections').delete().eq('id', id);
  throwIf(error);
}

// ============================================================
// Labels
// ============================================================

export async function fetchLabels(db: Client): Promise<Label[]> {
  const { data, error } = await db.from('labels').select('*').order('name');
  throwIf(error);
  return (data ?? []) as Label[];
}

export async function createLabel(db: Client, input: { name: string; color?: string }): Promise<Label> {
  const { data: auth } = await db.auth.getUser();
  const { data, error } = await db
    .from('labels')
    .insert({ ...input, user_id: auth.user?.id })
    .select()
    .single();
  throwIf(error);
  return data as Label;
}

export async function updateLabel(db: Client, id: string, patch: { name?: string; color?: string }): Promise<void> {
  const { error } = await db.from('labels').update(patch).eq('id', id);
  throwIf(error);
}

export async function deleteLabel(db: Client, id: string): Promise<void> {
  const { error } = await db.from('labels').delete().eq('id', id);
  throwIf(error);
}

/** Find labels by name (case-insensitive), creating any that do not exist. */
export async function ensureLabels(db: Client, names: string[]): Promise<Label[]> {
  if (names.length === 0) return [];
  const existing = await fetchLabels(db);
  const out: Label[] = [];
  for (const name of names) {
    const found = existing.find((l) => l.name.toLowerCase() === name.toLowerCase());
    out.push(found ?? (await createLabel(db, { name })));
  }
  return out;
}

// ============================================================
// Tasks
// ============================================================

function withLabelIds(rows: (Task & { task_labels?: { label_id: string }[] })[]): TaskWithLabels[] {
  return rows.map((r) => {
    const { task_labels, ...task } = r;
    return { ...task, label_ids: (task_labels ?? []).map((tl) => tl.label_id) };
  });
}

/** All active (not completed) tasks for the user, with label ids. */
export async function fetchActiveTasks(db: Client): Promise<TaskWithLabels[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*, task_labels(label_id)')
    .eq('is_completed', false)
    .order('sort_order')
    .order('created_at');
  throwIf(error);
  return withLabelIds((data ?? []) as never);
}

export async function fetchCompletedTasks(db: Client, limit = 100): Promise<TaskWithLabels[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*, task_labels(label_id)')
    .eq('is_completed', true)
    .order('completed_at', { ascending: false })
    .limit(limit);
  throwIf(error);
  return withLabelIds((data ?? []) as never);
}

export async function createTask(db: Client, input: NewTaskInput): Promise<Task> {
  const { data: auth } = await db.auth.getUser();
  const { label_ids, ...fields } = input;
  const { data, error } = await db
    .from('tasks')
    .insert({ ...fields, user_id: auth.user?.id })
    .select()
    .single();
  throwIf(error);
  const task = data as Task;
  if (label_ids && label_ids.length > 0) {
    const { error: e2 } = await db
      .from('task_labels')
      .insert(label_ids.map((label_id) => ({ task_id: task.id, label_id, user_id: task.user_id })));
    throwIf(e2);
  }
  return task;
}

export async function updateTask(db: Client, id: string, patch: UpdateTaskInput): Promise<void> {
  const { error } = await db.from('tasks').update(patch).eq('id', id);
  throwIf(error);
}

export async function setTaskLabels(db: Client, task: Pick<Task, 'id' | 'user_id'>, labelIds: string[]): Promise<void> {
  const { error: delError } = await db.from('task_labels').delete().eq('task_id', task.id);
  throwIf(delError);
  if (labelIds.length > 0) {
    const { error } = await db
      .from('task_labels')
      .insert(labelIds.map((label_id) => ({ task_id: task.id, label_id, user_id: task.user_id })));
    throwIf(error);
  }
}

export async function deleteTask(db: Client, id: string): Promise<void> {
  const { error } = await db.from('tasks').delete().eq('id', id);
  throwIf(error);
}

/**
 * Complete a task. Recurring tasks roll forward to their next occurrence
 * instead of completing; one-off tasks are marked done (with subtasks).
 */
export async function completeTask(db: Client, task: Task): Promise<void> {
  if (task.recurrence) {
    const { error } = await db
      .from('tasks')
      .update({ due_date: nextOccurrence(task.recurrence, task.due_date) })
      .eq('id', task.id);
    throwIf(error);
    return;
  }
  const now = new Date().toISOString();
  const { error } = await db
    .from('tasks')
    .update({ is_completed: true, completed_at: now })
    .or(`id.eq.${task.id},parent_id.eq.${task.id}`);
  throwIf(error);
}

export async function uncompleteTask(db: Client, id: string): Promise<void> {
  const { error } = await db
    .from('tasks')
    .update({ is_completed: false, completed_at: null })
    .eq('id', id);
  throwIf(error);
}

export async function setTaskPriority(db: Client, id: string, priority: Priority): Promise<void> {
  const { error } = await db.from('tasks').update({ priority }).eq('id', id);
  throwIf(error);
}

// ============================================================
// Auth helpers (username login)
// ============================================================

export const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

export async function isUsernameAvailable(db: Client, username: string): Promise<boolean> {
  const { data, error } = await db.rpc('username_available', { p_username: username });
  throwIf(error);
  return data === true;
}

/** Accepts an email or a username; returns the email to sign in with, or null if unknown. */
export async function resolveLoginEmail(db: Client, identifier: string): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes('@')) return id;
  const { data, error } = await db.rpc('email_for_username', { p_username: id });
  throwIf(error);
  return (data as string | null) ?? null;
}
