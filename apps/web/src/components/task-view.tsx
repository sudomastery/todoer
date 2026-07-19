'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  filterTasks,
  groupTasks,
  isDefaultDisplay,
  PRIORITY_COLORS,
  sortTasksBy,
  type DisplayPrefs,
  type TaskWithLabels,
} from '@todoer/shared';
import { useLabels, useProjects } from '@/lib/hooks';
import { TaskList } from '@/components/task-list';
import { TaskItem } from '@/components/task-item';

/**
 * Renders a set of tasks according to the view's display preferences:
 * list/board/calendar layout, grouping, sorting, filters, completed tasks.
 * When the prefs are all defaults and a `fallback` is given, the view's
 * native layout is rendered instead (e.g. the project page's sections).
 */
export function TaskView({
  prefs,
  tasks,
  completedTasks = [],
  allTasks,
  showProject = false,
  fallback,
  emptyMessage = 'No tasks match the current display settings.',
}: {
  prefs: DisplayPrefs;
  tasks: TaskWithLabels[];
  completedTasks?: TaskWithLabels[];
  allTasks: TaskWithLabels[];
  showProject?: boolean;
  fallback?: React.ReactNode;
  emptyMessage?: string;
}) {
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  if (fallback && isDefaultDisplay(prefs)) return <>{fallback}</>;

  const pool = prefs.showCompleted ? [...tasks, ...completedTasks] : tasks;
  const filtered = filterTasks(pool, prefs);
  const all = prefs.showCompleted ? [...allTasks, ...completedTasks] : allTasks;

  if (prefs.layout === 'calendar') {
    return <CalendarLayout tasks={sortTasksBy(filtered, prefs.sortBy)} />;
  }

  const groups = groupTasks(filtered, prefs.groupBy, {
    projects: projects ?? [],
    labels: labels ?? [],
  });

  if (filtered.length === 0) {
    return <p className="py-6 text-sm text-fg-faint">{emptyMessage}</p>;
  }

  if (prefs.layout === 'board') {
    return (
      <div className="mt-4 flex items-start gap-4 overflow-x-auto pb-4">
        {groups.map((g) => (
          <div key={g.key} className="w-72 shrink-0 rounded-lg bg-bg-sidebar p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{g.title}</h2>
              <span className="text-xs text-fg-faint">{g.tasks.length}</span>
            </div>
            <div>
              {sortTasksBy(g.tasks, prefs.sortBy)
                .filter((t) => !t.parent_id || !g.tasks.some((p) => p.id === t.parent_id))
                .map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    subtasks={sortTasksBy(all.filter((s) => s.parent_id === t.id), 'manual')}
                    showProject={showProject}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {groups.map((g) => (
        <section key={g.key} className="mt-6">
          {prefs.groupBy !== 'none' && (
            <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">
              {g.title} <span className="ml-1 font-normal text-fg-faint">{g.tasks.length}</span>
            </h2>
          )}
          <TaskList tasks={g.tasks} allTasks={all} showProject={showProject} sortBy={prefs.sortBy} />
        </section>
      ))}
    </div>
  );
}

function CalendarLayout({ tasks }: { tasks: TaskWithLabels[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const undated = tasks.filter((t) => !t.due_date);
  const today = new Date();

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded p-1 text-fg-secondary hover:bg-bg-hover"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="rounded px-2 py-1 text-xs text-fg-secondary hover:bg-bg-hover"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded p-1 text-fg-secondary hover:bg-bg-hover"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-border-default text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="border-b border-r border-border-default bg-bg-sidebar px-1.5 py-1 font-semibold text-fg-secondary">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const dayTasks = tasks.filter((t) => t.due_date === iso);
          return (
            <div
              key={iso}
              className={
                'min-h-24 border-b border-r border-border-default p-1 ' +
                (isSameMonth(day, month) ? '' : 'bg-bg-hover/40 text-fg-faint')
              }
            >
              <span
                className={
                  'inline-flex h-5 w-5 items-center justify-center rounded-full ' +
                  (isSameDay(day, today) ? 'bg-brand font-semibold text-white' : '')
                }
              >
                {format(day, 'd')}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    title={t.content}
                    className={
                      'flex items-center gap-1 truncate rounded bg-bg-hover px-1 py-0.5 ' +
                      (t.is_completed ? 'line-through opacity-60' : '')
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          t.priority < 4 ? PRIORITY_COLORS[t.priority] : 'var(--color-fg-faint)',
                      }}
                    />
                    <span className="truncate">{t.content}</span>
                  </div>
                ))}
                {dayTasks.length > 4 && (
                  <div className="px-1 text-fg-faint">+{dayTasks.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <p className="mt-2 text-xs text-fg-faint">
          {undated.length} task{undated.length === 1 ? '' : 's'} without a due date not shown.
        </p>
      )}
    </div>
  );
}
