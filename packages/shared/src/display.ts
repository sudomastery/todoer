import type { Label, Priority, Project, TaskWithLabels } from './types';
import { todayISO } from './dates';

// View display preferences, mirroring Todoist's Display menu.

export type LayoutMode = 'list' | 'board' | 'calendar';
export type GroupBy = 'none' | 'project' | 'priority' | 'label' | 'date';
export type SortBy = 'manual' | 'date' | 'priority' | 'name' | 'added';
export type DateFilter = 'all' | 'overdue' | 'today' | 'week' | 'nodate';

export interface DisplayPrefs {
  layout: LayoutMode;
  showCompleted: boolean;
  groupBy: GroupBy;
  sortBy: SortBy;
  dateFilter: DateFilter;
  /** 0 means all priorities */
  priorityFilter: 0 | Priority;
  /** label id, or null for all */
  labelFilter: string | null;
}

export const DEFAULT_DISPLAY: DisplayPrefs = {
  layout: 'list',
  showCompleted: false,
  groupBy: 'none',
  sortBy: 'manual',
  dateFilter: 'all',
  priorityFilter: 0,
  labelFilter: null,
};

export function isDefaultDisplay(p: DisplayPrefs): boolean {
  return (Object.keys(DEFAULT_DISPLAY) as (keyof DisplayPrefs)[]).every(
    (k) => p[k] === DEFAULT_DISPLAY[k],
  );
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function filterTasks(tasks: TaskWithLabels[], prefs: DisplayPrefs): TaskWithLabels[] {
  const today = todayISO();
  const weekEnd = isoAddDays(today, 7);
  return tasks.filter((t) => {
    if (prefs.priorityFilter !== 0 && t.priority !== prefs.priorityFilter) return false;
    if (prefs.labelFilter && !t.label_ids.includes(prefs.labelFilter)) return false;
    switch (prefs.dateFilter) {
      case 'overdue':
        return !!t.due_date && t.due_date < today;
      case 'today':
        return !!t.due_date && t.due_date <= today;
      case 'week':
        return !!t.due_date && t.due_date <= weekEnd;
      case 'nodate':
        return !t.due_date;
      default:
        return true;
    }
  });
}

export function sortTasksBy(tasks: TaskWithLabels[], sortBy: SortBy): TaskWithLabels[] {
  // Manual is the order the user dragged tasks into, so it cannot lead with
  // priority: doing that would snap a task dragged below a higher priority one
  // straight back. Priority ordering is its own sort option.
  const manual = (a: TaskWithLabels, b: TaskWithLabels) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  };
  const byPriority = (a: TaskWithLabels, b: TaskWithLabels) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return manual(a, b);
  };
  const byDate = (a: TaskWithLabels, b: TaskWithLabels) => {
    if (!a.due_date && !b.due_date) return manual(a, b);
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
    const at = a.due_time ?? '99';
    const bt = b.due_time ?? '99';
    if (at !== bt) return at.localeCompare(bt);
    return manual(a, b);
  };
  const cmp: Record<SortBy, (a: TaskWithLabels, b: TaskWithLabels) => number> = {
    manual,
    date: byDate,
    priority: byPriority,
    name: (a, b) => a.content.localeCompare(b.content) || manual(a, b),
    added: (a, b) => a.created_at.localeCompare(b.created_at),
  };
  return [...tasks].sort(cmp[sortBy]);
}

/** Whether a drag handle should do anything under the current sort. */
export function canReorder(sortBy: SortBy): boolean {
  return sortBy === 'manual';
}

/**
 * The sort_order values needed to move one item within a list.
 *
 * The list is renumbered from zero, but only the entries that actually change
 * are returned, so dragging near the end of a long list writes a few rows
 * rather than all of them. Returns nothing when the move is a no-op or the
 * indexes fall outside the list.
 */
export function reorderSortOrders<T extends { id: string; sort_order: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): { id: string; sort_order: number }[] {
  if (fromIndex === toIndex) return [];
  if (fromIndex < 0 || fromIndex >= items.length) return [];
  if (toIndex < 0 || toIndex >= items.length) return [];

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  const updates: { id: string; sort_order: number }[] = [];
  next.forEach((item, index) => {
    if (item.sort_order !== index) updates.push({ id: item.id, sort_order: index });
  });
  return updates;
}

export interface TaskGroup {
  key: string;
  title: string;
  /** hex accent for the group header, when it has a natural color */
  color?: string;
  tasks: TaskWithLabels[];
}

export function groupTasks(
  tasks: TaskWithLabels[],
  groupBy: GroupBy,
  ctx: { projects: Project[]; labels: Label[] },
): TaskGroup[] {
  if (groupBy === 'none') return [{ key: 'all', title: 'Tasks', tasks }];

  if (groupBy === 'priority') {
    const names: Record<number, string> = { 1: 'Priority 1', 2: 'Priority 2', 3: 'Priority 3', 4: 'Priority 4' };
    return [1, 2, 3, 4]
      .map((p) => ({ key: `p${p}`, title: names[p], tasks: tasks.filter((t) => t.priority === p) }))
      .filter((g) => g.tasks.length > 0);
  }

  if (groupBy === 'project') {
    return ctx.projects
      .map((proj) => ({
        key: proj.id,
        title: proj.name,
        tasks: tasks.filter((t) => t.project_id === proj.id),
      }))
      .filter((g) => g.tasks.length > 0);
  }

  if (groupBy === 'label') {
    const groups = ctx.labels.map((l) => ({
      key: l.id,
      title: `@${l.name}`,
      tasks: tasks.filter((t) => t.label_ids.includes(l.id)),
    }));
    const noLabel = tasks.filter((t) => t.label_ids.length === 0);
    if (noLabel.length > 0) groups.push({ key: 'nolabel', title: 'No label', tasks: noLabel });
    return groups.filter((g) => g.tasks.length > 0);
  }

  // date buckets
  const today = todayISO();
  const tomorrow = isoAddDays(today, 1);
  const weekEnd = isoAddDays(today, 7);
  const buckets: { key: string; title: string; match: (t: TaskWithLabels) => boolean }[] = [
    { key: 'overdue', title: 'Overdue', match: (t) => !!t.due_date && t.due_date < today },
    { key: 'today', title: 'Today', match: (t) => t.due_date === today },
    { key: 'tomorrow', title: 'Tomorrow', match: (t) => t.due_date === tomorrow },
    {
      key: 'week',
      title: 'Next 7 days',
      match: (t) => !!t.due_date && t.due_date > tomorrow && t.due_date <= weekEnd,
    },
    { key: 'later', title: 'Later', match: (t) => !!t.due_date && t.due_date > weekEnd },
    { key: 'nodate', title: 'No date', match: (t) => !t.due_date },
  ];
  return buckets
    .map((b) => ({ key: b.key, title: b.title, tasks: tasks.filter(b.match) }))
    .filter((g) => g.tasks.length > 0);
}
