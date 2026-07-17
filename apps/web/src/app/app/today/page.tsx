'use client';

import { format } from 'date-fns';
import { isOverdue, isToday, todayISO } from '@todoer/shared';
import { useActiveTasks } from '@/lib/hooks';
import { AddTaskButton, TaskList } from '@/components/task-list';

export default function TodayPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const all = tasks ?? [];

  const overdue = all.filter((t) => t.due_date && isOverdue(t.due_date));
  const today = all.filter((t) => t.due_date && isToday(t.due_date));

  return (
    <div>
      <h1 className="text-2xl font-bold">Today</h1>
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
              emptyMessage={
                overdue.length === 0
                  ? 'Enjoy your day! Nothing due today.'
                  : undefined
              }
            />
            <AddTaskButton defaultDueDate={todayISO()} />
          </section>
        </>
      )}
    </div>
  );
}
