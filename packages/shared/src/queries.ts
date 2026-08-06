import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminAuditLogRow,
  AdminDbStats,
  AdminListUsersParams,
  AdminStats,
  AdminUserRow,
  Label,
  NewTaskInput,
  Priority,
  Profile,
  Project,
  Section,
  Task,
  TaskComment,
  TaskWithLabels,
  UpdateTaskInput,
} from './types';
import { nextOccurrence } from './recurrence';
import { COLOR_KEYS } from './colors';

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

/**
 * Find projects by name (case-insensitive), creating any that do not exist,
 * mirroring ensureLabels: a `#project` token in quick add is meant to work
 * like an `@label` one, so an unrecognized name becomes a new project rather
 * than silently falling back to the current/default project.
 */
export async function ensureProjects(db: Client, names: string[]): Promise<Project[]> {
  if (names.length === 0) return [];
  const existing = await fetchProjects(db);
  const out: Project[] = [];
  for (const name of names) {
    const found = existing.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (found) {
      out.push(found);
      continue;
    }
    const color = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    const created = await createProject(db, { name, color });
    existing.push(created);
    out.push(created);
  }
  return out;
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

/**
 * Adds children to a task that was just created, so a task and its checklist
 * can be entered in one pass instead of saving, reopening the task, and adding
 * the subtasks one at a time.
 *
 * They are inserted in order rather than in parallel because manual sort order
 * is assigned on insert, and concurrent writes would land the list shuffled.
 * Blank names are dropped, which keeps a stray empty row in the composer from
 * creating an unnamed subtask.
 */
export async function createSubtasks(
  db: Client,
  parent: Pick<Task, 'id' | 'project_id' | 'section_id'>,
  names: string[],
): Promise<void> {
  for (const name of names) {
    const content = name.trim();
    if (!content) continue;
    await createTask(db, {
      content,
      project_id: parent.project_id,
      section_id: parent.section_id,
      parent_id: parent.id,
    });
  }
}

export async function updateTask(db: Client, id: string, patch: UpdateTaskInput): Promise<void> {
  const { error } = await db.from('tasks').update(patch).eq('id', id);
  throwIf(error);
}

/**
 * Persists new manual ordering. The updates come from reorderSortOrders, which
 * already trims the list to rows whose position actually moved.
 */
export async function reorderTasks(
  db: Client,
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const results = await Promise.all(
    updates.map(({ id, sort_order }) => db.from('tasks').update({ sort_order }).eq('id', id)),
  );
  for (const { error } of results) throwIf(error);
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
// Profile
// ============================================================

export async function fetchProfile(db: Client): Promise<Profile | null> {
  const { data, error } = await db.from('profiles').select('*').maybeSingle();
  throwIf(error);
  return (data as Profile | null) ?? null;
}

// ============================================================
// Comments
// ============================================================

export async function fetchComments(db: Client, taskId: string): Promise<TaskComment[]> {
  const { data, error } = await db
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');
  throwIf(error);
  return (data ?? []) as TaskComment[];
}

export async function addComment(db: Client, taskId: string, content: string): Promise<TaskComment> {
  const { data: auth } = await db.auth.getUser();
  const { data, error } = await db
    .from('task_comments')
    .insert({ task_id: taskId, content, user_id: auth.user?.id })
    .select()
    .single();
  throwIf(error);
  return data as TaskComment;
}

export async function updateComment(db: Client, id: string, content: string): Promise<void> {
  const { error } = await db.from('task_comments').update({ content }).eq('id', id);
  throwIf(error);
}

export async function deleteComment(db: Client, id: string): Promise<void> {
  const { error } = await db.from('task_comments').delete().eq('id', id);
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

/** Completed tasks since an ISO date, for productivity stats. */
export async function fetchCompletedSince(db: Client, sinceIso: string): Promise<TaskWithLabels[]> {
  const { data, error } = await db
    .from('tasks')
    .select('*, task_labels(label_id)')
    .eq('is_completed', true)
    .gte('completed_at', `${sinceIso}T00:00:00`)
    .order('completed_at', { ascending: true })
    .limit(2000);
  throwIf(error);
  return withLabelIds((data ?? []) as never);
}

// ============================================================
// Account: export and deletion
// ============================================================

export interface TodoerExport {
  format: 'todoer-export';
  version: 2;
  exported_at: string;
  projects: Project[];
  sections: Section[];
  labels: Label[];
  tasks: TaskWithLabels[];
  comments: TaskComment[];
}

/** Everything the user owns, including completed tasks, as one JSON document. */
export async function buildExport(db: Client): Promise<TodoerExport> {
  const [projects, sections, labels] = await Promise.all([
    fetchProjects(db),
    fetchSections(db),
    fetchLabels(db),
  ]);
  const { data, error } = await db
    .from('tasks')
    .select('*, task_labels(label_id)')
    .order('created_at', { ascending: true });
  throwIf(error);
  const { data: comments, error: cErr } = await db
    .from('task_comments')
    .select('*')
    .order('created_at', { ascending: true });
  throwIf(cErr);
  return {
    format: 'todoer-export',
    version: 2,
    exported_at: new Date().toISOString(),
    projects,
    sections,
    labels,
    tasks: withLabelIds((data ?? []) as never),
    comments: (comments ?? []) as TaskComment[],
  };
}

/** Permanently deletes the signed-in user's account and all their data. */
export async function deleteAccount(db: Client): Promise<void> {
  const { error } = await db.rpc('delete_account');
  throwIf(error);
}

// ============================================================
// Admin
// ============================================================

/** Whether the signed-in user is an admin. Every admin RPC re-checks this itself. */
export async function isAdmin(db: Client): Promise<boolean> {
  const { data, error } = await db.rpc('is_admin');
  throwIf(error);
  return Boolean(data);
}

export async function adminListUsers(
  db: Client,
  params: AdminListUsersParams = {},
): Promise<AdminUserRow[]> {
  const { data, error } = await db.rpc('admin_list_users', {
    p_search: params.search || null,
    p_role: params.role || null,
    p_banned_only: params.bannedOnly ?? false,
    p_sort: params.sort ?? 'created_at',
    p_sort_dir: params.sortDir ?? 'desc',
    p_limit: params.limit ?? 25,
    p_offset: params.offset ?? 0,
  });
  throwIf(error);
  return (data ?? []) as AdminUserRow[];
}

/** Bans a user for `days` days, or unbans immediately when `days` is 0. */
export async function adminBanUser(
  db: Client,
  userId: string,
  days: number,
  reason?: string,
): Promise<void> {
  const { error } = await db.rpc('admin_ban_user', {
    p_user_id: userId,
    p_days: days,
    p_reason: reason || null,
  });
  throwIf(error);
}

/** Permanently deletes another user's account. Cannot target yourself or another admin. */
export async function adminDeleteUser(db: Client, userId: string, reason?: string): Promise<void> {
  const { error } = await db.rpc('admin_delete_user', {
    p_user_id: userId,
    p_reason: reason || null,
  });
  throwIf(error);
}

/** Promotes or demotes another user. Cannot target yourself; refuses to demote the last admin. */
export async function adminSetRole(
  db: Client,
  userId: string,
  role: 'user' | 'admin',
  reason?: string,
): Promise<void> {
  const { error } = await db.rpc('admin_set_role', {
    p_user_id: userId,
    p_role: role,
    p_reason: reason || null,
  });
  throwIf(error);
}

/** Headline dashboard numbers: total users, and gained/lost over the last `days` days. */
export async function adminStats(db: Client, days = 30): Promise<AdminStats> {
  const { data, error } = await db.rpc('admin_stats', { p_days: days });
  throwIf(error);
  const row = (data ?? [])[0] as AdminStats | undefined;
  return row ?? { total_users: 0, gained: 0, lost: 0 };
}

/** Paginated, human-readable audit log (emails joined in) for the audit log viewer. */
export async function adminAuditLogPage(
  db: Client,
  limit = 25,
  offset = 0,
): Promise<AdminAuditLogRow[]> {
  const { data, error } = await db.rpc('admin_audit_log_page', { p_limit: limit, p_offset: offset });
  throwIf(error);
  return (data ?? []) as AdminAuditLogRow[];
}

/** Total DB size and largest tables, for the admin dashboard's storage tile. */
export async function adminDbStats(db: Client): Promise<AdminDbStats> {
  const { data, error } = await db.rpc('admin_db_stats');
  throwIf(error);
  const row = (data ?? [])[0] as AdminDbStats | undefined;
  return row ?? { db_size_bytes: 0, table_sizes: [] };
}
