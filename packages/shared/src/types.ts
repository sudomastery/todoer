export type Priority = 1 | 2 | 3 | 4;

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface AdminAuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  role: 'user' | 'admin';
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_inbox: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
}

export interface Section {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  content: string;
  description: string;
  priority: Priority;
  /** ISO date, e.g. '2026-07-17' */
  due_date: string | null;
  /** 'HH:MM:SS' when the task has a specific time */
  due_time: string | null;
  recurrence: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
  user_id: string;
}

export interface TaskComment {
  id: string;
  user_id: string;
  task_id: string;
  content: string;
  created_at: string;
}

/** Task joined with its label ids, the shape both apps render. */
export interface TaskWithLabels extends Task {
  label_ids: string[];
}

export interface NewTaskInput {
  /** Client-generated id, used by offline-first callers so an optimistic
   * row and its eventual server row share one id. Omitted callers get a
   * DB-assigned id as before. */
  id?: string;
  content: string;
  description?: string;
  project_id: string;
  section_id?: string | null;
  parent_id?: string | null;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
  label_ids?: string[];
}

export interface UpdateTaskInput {
  content?: string;
  description?: string;
  project_id?: string;
  section_id?: string | null;
  parent_id?: string | null;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
  sort_order?: number;
}
