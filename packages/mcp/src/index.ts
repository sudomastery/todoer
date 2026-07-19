#!/usr/bin/env node
// Todoer MCP server: exposes the signed-in user's tasks, projects, sections,
// labels, and comments as MCP tools over stdio. Auth is the user's normal
// Todoer login; row level security scopes every call to their own data.
//
// Env:
//   TODOER_LOGIN     email or username (required)
//   TODOER_PASSWORD  account password (required)
//   TODOER_URL       Supabase URL (defaults to production)
//   TODOER_ANON_KEY  Supabase publishable key (defaults to production)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  addComment,
  buildExport,
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
  resolveLoginEmail,
  setTaskLabels,
  todayISO,
  uncompleteTask,
  updateProject,
  updateTask,
  type Label,
  type Priority,
  type Project,
  type TaskWithLabels,
} from '@todoer/shared';

const URL = process.env.TODOER_URL ?? 'https://lmzwafwjersclyvjustk.supabase.co';
const KEY = process.env.TODOER_ANON_KEY ?? 'sb_publishable_mbnia9TX0ZiVkMFwXAq_Vg_dyVpmTNV';
const LOGIN = process.env.TODOER_LOGIN;
const PASSWORD = process.env.TODOER_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error('Set TODOER_LOGIN (email or username) and TODOER_PASSWORD.');
  process.exit(1);
}

const db: SupabaseClient = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});

// ============================================================
// Helpers
// ============================================================

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

function handler<A>(fn: (args: A) => Promise<ToolResult>): (args: A) => Promise<ToolResult> {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  };
}

/** Accepts a project id or (case-insensitive) name. */
async function resolveProject(ref: string): Promise<Project> {
  const projects = await fetchProjects(db);
  const found =
    projects.find((p) => p.id === ref) ??
    projects.find((p) => p.name.toLowerCase() === ref.trim().toLowerCase());
  if (!found) {
    throw new Error(
      `No project named "${ref}". Projects: ${projects.map((p) => p.name).join(', ')}`,
    );
  }
  return found;
}

async function getTask(id: string): Promise<TaskWithLabels> {
  const { data, error } = await db
    .from('tasks')
    .select('*, task_labels(label_id)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No task with id ${id}.`);
  const { task_labels, ...task } = data as TaskWithLabels & { task_labels: { label_id: string }[] };
  return { ...task, label_ids: (task_labels ?? []).map((tl) => tl.label_id) };
}

function taskSummary(t: TaskWithLabels, projects: Project[], labels: Label[]) {
  return {
    id: t.id,
    content: t.content,
    description: t.description || undefined,
    project: projects.find((p) => p.id === t.project_id)?.name ?? t.project_id,
    section_id: t.section_id ?? undefined,
    parent_id: t.parent_id ?? undefined,
    priority: t.priority,
    due_date: t.due_date ?? undefined,
    due_time: t.due_time ?? undefined,
    recurrence: t.recurrence ?? undefined,
    labels: t.label_ids
      .map((id) => labels.find((l) => l.id === id)?.name)
      .filter((n): n is string => !!n),
    is_completed: t.is_completed,
    completed_at: t.completed_at ?? undefined,
  };
}

async function summaries(tasks: TaskWithLabels[]) {
  const [projects, labels] = await Promise.all([fetchProjects(db), fetchLabels(db)]);
  return tasks.map((t) => taskSummary(t, projects, labels));
}

const prioritySchema = z.number().int().min(1).max(4);

// ============================================================
// Server and tools
// ============================================================

const server = new McpServer({ name: 'todoer', version: '0.1.0' });

server.registerTool(
  'list_projects',
  { description: 'List all projects with their ids, colors, and favorite state.' },
  handler(async () => ok(await fetchProjects(db))),
);

server.registerTool(
  'create_project',
  {
    description: 'Create a new project.',
    inputSchema: {
      name: z.string().min(1).max(120),
      color: z.string().optional().describe('Color name, e.g. red, blue, teal, grey'),
      favorite: z.boolean().optional(),
    },
  },
  handler(async ({ name, color, favorite }) =>
    ok(await createProject(db, { name, color: color ?? 'charcoal', is_favorite: favorite ?? false })),
  ),
);

server.registerTool(
  'update_project',
  {
    description: 'Rename a project or change its color, favorite, or archived state.',
    inputSchema: {
      project: z.string().describe('Project id or name'),
      name: z.string().min(1).max(120).optional(),
      color: z.string().optional(),
      favorite: z.boolean().optional(),
      archived: z.boolean().optional(),
    },
  },
  handler(async ({ project, name, color, favorite, archived }) => {
    const p = await resolveProject(project);
    await updateProject(db, p.id, {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(favorite !== undefined && { is_favorite: favorite }),
      ...(archived !== undefined && { is_archived: archived }),
    });
    return ok({ updated: p.id });
  }),
);

server.registerTool(
  'delete_project',
  {
    description: 'Delete a project and every task in it. The Inbox cannot be deleted.',
    inputSchema: { project: z.string().describe('Project id or name') },
  },
  handler(async ({ project }) => {
    const p = await resolveProject(project);
    if (p.is_inbox) return fail('The Inbox cannot be deleted.');
    await deleteProject(db, p.id);
    return ok({ deleted: p.name });
  }),
);

server.registerTool(
  'list_sections',
  {
    description: 'List sections, optionally only those of one project.',
    inputSchema: { project: z.string().optional().describe('Project id or name') },
  },
  handler(async ({ project }) => {
    const sections = await fetchSections(db);
    if (!project) return ok(sections);
    const p = await resolveProject(project);
    return ok(sections.filter((s) => s.project_id === p.id));
  }),
);

server.registerTool(
  'create_section',
  {
    description: 'Create a section inside a project.',
    inputSchema: {
      project: z.string().describe('Project id or name'),
      name: z.string().min(1).max(120),
    },
  },
  handler(async ({ project, name }) => {
    const p = await resolveProject(project);
    return ok(await createSection(db, { project_id: p.id, name }));
  }),
);

server.registerTool(
  'delete_section',
  {
    description: 'Delete a section. Its tasks stay in the project without a section.',
    inputSchema: { section_id: z.string().uuid() },
  },
  handler(async ({ section_id }) => {
    await deleteSection(db, section_id);
    return ok({ deleted: section_id });
  }),
);

server.registerTool(
  'list_labels',
  { description: 'List all labels.' },
  handler(async () => ok(await fetchLabels(db))),
);

server.registerTool(
  'create_label',
  {
    description: 'Create a label.',
    inputSchema: { name: z.string().min(1).max(60), color: z.string().optional() },
  },
  handler(async ({ name, color }) => ok(await createLabel(db, { name, color }))),
);

server.registerTool(
  'delete_label',
  {
    description: 'Delete a label by id or name. It is removed from all tasks.',
    inputSchema: { label: z.string().describe('Label id or name') },
  },
  handler(async ({ label }) => {
    const labels = await fetchLabels(db);
    const found =
      labels.find((l) => l.id === label) ??
      labels.find((l) => l.name.toLowerCase() === label.trim().toLowerCase());
    if (!found) return fail(`No label "${label}". Labels: ${labels.map((l) => l.name).join(', ')}`);
    await deleteLabel(db, found.id);
    return ok({ deleted: found.name });
  }),
);

server.registerTool(
  'list_tasks',
  {
    description:
      'List active tasks. view filters by due date: today (due today or overdue), overdue, upcoming (due after today), nodate, or all (default). Optionally filter by project, label, or a search string.',
    inputSchema: {
      view: z.enum(['all', 'today', 'overdue', 'upcoming', 'nodate']).optional(),
      project: z.string().optional().describe('Project id or name'),
      label: z.string().optional().describe('Label name'),
      search: z.string().optional().describe('Case-insensitive substring of the task text'),
    },
  },
  handler(async ({ view, project, label, search }) => {
    let tasks = await fetchActiveTasks(db);
    const today = todayISO();
    if (view === 'today') tasks = tasks.filter((t) => t.due_date && t.due_date <= today);
    if (view === 'overdue') tasks = tasks.filter((t) => t.due_date && t.due_date < today);
    if (view === 'upcoming') tasks = tasks.filter((t) => t.due_date && t.due_date > today);
    if (view === 'nodate') tasks = tasks.filter((t) => !t.due_date);
    if (project) {
      const p = await resolveProject(project);
      tasks = tasks.filter((t) => t.project_id === p.id);
    }
    if (label) {
      const labels = await fetchLabels(db);
      const l = labels.find((x) => x.name.toLowerCase() === label.trim().toLowerCase());
      if (!l) return fail(`No label "${label}". Labels: ${labels.map((x) => x.name).join(', ')}`);
      tasks = tasks.filter((t) => t.label_ids.includes(l.id));
    }
    if (search) {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        (t) => t.content.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
      );
    }
    return ok(await summaries(tasks));
  }),
);

server.registerTool(
  'list_completed_tasks',
  {
    description: 'List recently completed tasks, newest first.',
    inputSchema: { limit: z.number().int().min(1).max(500).optional() },
  },
  handler(async ({ limit }) => ok(await summaries(await fetchCompletedTasks(db, limit ?? 50)))),
);

server.registerTool(
  'add_task',
  {
    description:
      'Add a task. The text supports Todoist-style quick add syntax: natural language dates ("tomorrow 5pm", "every monday"), priority p1-p4, #ProjectName, and @label tokens. Explicit fields override parsed tokens. Defaults to the Inbox.',
    inputSchema: {
      text: z.string().min(1).describe('Task text, quick add tokens allowed'),
      project: z.string().optional().describe('Project id or name'),
      section_id: z.string().uuid().optional(),
      parent_task_id: z.string().uuid().optional().describe('Make this a subtask of another task'),
      description: z.string().optional(),
      due_date: z.string().optional().describe('YYYY-MM-DD'),
      priority: prioritySchema.optional().describe('1 highest .. 4 none'),
      labels: z.array(z.string()).optional().describe('Label names, created if missing'),
    },
  },
  handler(async ({ text, project, section_id, parent_task_id, description, due_date, priority, labels }) => {
    const parsed = parseQuickAdd(text);
    const projects = await fetchProjects(db);
    let projectId: string | undefined;
    if (project) projectId = (await resolveProject(project)).id;
    else if (parsed.projectName) {
      projectId = projects.find(
        (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase(),
      )?.id;
    }
    projectId ??= projects.find((p) => p.is_inbox)?.id;
    if (!projectId) return fail('No project found and no Inbox exists.');
    const labelNames = [...new Set([...(labels ?? []), ...parsed.labelNames])];
    const labelRows = await ensureLabels(db, labelNames);
    const task = await createTask(db, {
      content: parsed.content,
      description,
      project_id: projectId,
      section_id: section_id ?? null,
      parent_id: parent_task_id ?? null,
      priority: (priority as Priority | undefined) ?? parsed.priority,
      due_date: due_date ?? parsed.due_date,
      due_time: parsed.due_time,
      recurrence: parsed.recurrence,
      label_ids: labelRows.map((l) => l.id),
    });
    return ok((await summaries([{ ...task, label_ids: labelRows.map((l) => l.id) }]))[0]);
  }),
);

server.registerTool(
  'update_task',
  {
    description:
      'Update fields of a task. Pass an empty string for due_date, due_time, or recurrence to clear them.',
    inputSchema: {
      task_id: z.string().uuid(),
      content: z.string().min(1).optional(),
      description: z.string().optional(),
      project: z.string().optional().describe('Move to this project (id or name)'),
      due_date: z.string().optional().describe('YYYY-MM-DD, empty string clears'),
      due_time: z.string().optional().describe('HH:MM, empty string clears'),
      recurrence: z.string().optional().describe('e.g. daily, weekly:MO, empty string clears'),
      priority: prioritySchema.optional(),
    },
  },
  handler(async ({ task_id, content, description, project, due_date, due_time, recurrence, priority }) => {
    await getTask(task_id);
    const patch: Record<string, unknown> = {};
    if (content !== undefined) patch.content = content;
    if (description !== undefined) patch.description = description;
    if (project !== undefined) patch.project_id = (await resolveProject(project)).id;
    if (due_date !== undefined) patch.due_date = due_date === '' ? null : due_date;
    if (due_time !== undefined) patch.due_time = due_time === '' ? null : due_time;
    if (recurrence !== undefined) patch.recurrence = recurrence === '' ? null : recurrence;
    if (priority !== undefined) patch.priority = priority;
    if (Object.keys(patch).length === 0) return fail('Nothing to update.');
    await updateTask(db, task_id, patch);
    return ok((await summaries([await getTask(task_id)]))[0]);
  }),
);

server.registerTool(
  'set_task_labels',
  {
    description: 'Replace the labels on a task with the given label names (created if missing).',
    inputSchema: { task_id: z.string().uuid(), labels: z.array(z.string()) },
  },
  handler(async ({ task_id, labels }) => {
    const task = await getTask(task_id);
    const rows = await ensureLabels(db, labels);
    await setTaskLabels(db, task, rows.map((l) => l.id));
    return ok((await summaries([await getTask(task_id)]))[0]);
  }),
);

server.registerTool(
  'complete_task',
  {
    description:
      'Complete a task. Recurring tasks roll forward to the next occurrence; one-off tasks are marked done together with their subtasks.',
    inputSchema: { task_id: z.string().uuid() },
  },
  handler(async ({ task_id }) => {
    const task = await getTask(task_id);
    await completeTask(db, task);
    return ok(
      task.recurrence
        ? { rolled_forward: task_id, recurrence: task.recurrence }
        : { completed: task_id },
    );
  }),
);

server.registerTool(
  'uncomplete_task',
  {
    description: 'Reopen a completed task.',
    inputSchema: { task_id: z.string().uuid() },
  },
  handler(async ({ task_id }) => {
    await uncompleteTask(db, task_id);
    return ok({ reopened: task_id });
  }),
);

server.registerTool(
  'delete_task',
  {
    description: 'Permanently delete a task and its subtasks.',
    inputSchema: { task_id: z.string().uuid() },
  },
  handler(async ({ task_id }) => {
    await deleteTask(db, task_id);
    return ok({ deleted: task_id });
  }),
);

server.registerTool(
  'list_comments',
  {
    description: 'List the comments on a task, oldest first.',
    inputSchema: { task_id: z.string().uuid() },
  },
  handler(async ({ task_id }) => ok(await fetchComments(db, task_id))),
);

server.registerTool(
  'add_comment',
  {
    description: 'Add a comment to a task.',
    inputSchema: { task_id: z.string().uuid(), content: z.string().min(1).max(2000) },
  },
  handler(async ({ task_id, content }) => ok(await addComment(db, task_id, content))),
);

server.registerTool(
  'delete_comment',
  {
    description: 'Delete a comment.',
    inputSchema: { comment_id: z.string().uuid() },
  },
  handler(async ({ comment_id }) => {
    await deleteComment(db, comment_id);
    return ok({ deleted: comment_id });
  }),
);

server.registerTool(
  'productivity_stats',
  {
    description:
      'Completion statistics: tasks completed today, this week, current day streak, and overall completion rate.',
  },
  handler(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString().slice(0, 10);
    const [completed, active] = await Promise.all([
      fetchCompletedSince(db, sinceIso),
      fetchActiveTasks(db),
    ]);
    const today = todayISO();
    const dayOf = (t: TaskWithLabels) => t.completed_at?.slice(0, 10) ?? null;
    const completedToday = completed.filter((t) => dayOf(t) === today).length;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekIso = weekStart.toISOString().slice(0, 10);
    const completedWeek = completed.filter((t) => (dayOf(t) ?? '') >= weekIso).length;
    const days = new Set(completed.map(dayOf).filter(Boolean));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const done = completed.length;
    const rate = done + active.length > 0 ? Math.round((done / (done + active.length)) * 100) : 0;
    return ok({
      completed_today: completedToday,
      completed_this_week: completedWeek,
      day_streak: streak,
      active_tasks: active.length,
      completed_last_90_days: done,
      completion_rate_percent: rate,
    });
  }),
);

server.registerTool(
  'export_data',
  {
    description:
      'Export everything the user owns (projects, sections, labels, tasks, comments) as one JSON document.',
  },
  handler(async () => ok(await buildExport(db))),
);

// ============================================================
// Startup: sign in, then serve stdio
// ============================================================

async function main() {
  const email = await resolveLoginEmail(db, LOGIN!);
  if (!email) {
    console.error(`No account found for "${LOGIN}".`);
    process.exit(1);
  }
  const { error: authError } = await db.auth.signInWithPassword({ email, password: PASSWORD! });
  if (authError) {
    console.error(`Login failed: ${authError.message}`);
    process.exit(1);
  }

  await server.connect(new StdioServerTransport());
  console.error(`Todoer MCP server running as ${LOGIN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
