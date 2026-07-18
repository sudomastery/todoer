'use client';

import { format } from 'date-fns';
import { isOverdue, isToday, todayISO } from '@todoer/shared';
import { useActiveTasks, useCompletedTasks } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/display';
import { AddTaskButton, TaskList } from '@/components/task-list';
import { TaskView } from '@/components/task-view';
import { DisplayMenu } from '@/components/display-menu';

export default function TodayPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const { data: completed } = useCompletedTasks();
  const display = useDisplayPrefs('today');

  const all = tasks ?? [];
  const overdue = all.filter((t) => t.due_date && isOverdue(t.due_date));
  const today = all.filter((t) => t.due_date && isToday(t.due_date));
  const completedToday = (completed ?? []).filter(
    (t) => t.completed_at && t.completed_at.startsWith(todayISO()),
  );

  const defaultLayout = (
    <>
      {overdue.length > 0 && (
        <section className="mt-6">
          <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold text-p1">
            Overdue
          </h2>
          <TaskList tasks={overdue} allTasks={all} showProject />
        </section>
      )}

      <section className="mt-6">
        {overdue.length > 0 && (
          <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">
            {format(new Date(), 'MMM d')} {'·'} Today
          </h2>
        )}
        <TaskList
          tasks={today}
          allTasks={all}
          showProject
          emptyMessage={overdue.length === 0 ? 'Enjoy your day! Nothing due today.' : undefined}
        />
      </section>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Today</h1>
        <DisplayMenu state={display} />
      </div>
      <p className="mt-1 text-sm text-fg-secondary">
        {format(new Date(), 'EEE MMM d')}
        {overdue.length + today.length > 0 && (
          <span> {'·'} {overdue.length + today.length} tasks</span>
        )}
      </p>

      {isLoading ? (
        <p className="py-8 text-sm text-fg-faint">Loading…</p>
      ) : (
        <>
          <TaskView
            prefs={display.prefs}
            tasks={[...overdue, ...today]}
            completedTasks={completedToday}
            allTasks={all}
            showProject
            fallback={defaultLayout}
          />
          <AddTaskButton defaultDueDate={todayISO()} />
        </>
      )}
    </div>
  );
}
