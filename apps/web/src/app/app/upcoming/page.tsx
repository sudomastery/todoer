'use client';

import { formatDayHeading, isOverdue, upcomingDays } from '@todoer/shared';
import { useActiveTasks } from '@/lib/hooks';
import { AddTaskButton, TaskList } from '@/components/task-list';

const DAYS_SHOWN = 14;

export default function UpcomingPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const all = tasks ?? [];

  const days = upcomingDays(DAYS_SHOWN);
  const lastDay = days[days.length - 1];
  const overdue = all.filter((t) => t.due_date && isOverdue(t.due_date));
  const later = all.filter((t) => t.due_date && t.due_date > lastDay);

  return (
    <div>
      <h1 className="text-2xl font-bold">Upcoming</h1>

      {isLoading ? (
        <p className="py-8 text-sm text-fg-faint">Loading…</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold text-brand">
                Overdue
              </h2>
              <TaskList tasks={overdue} allTasks={all} showProject />
            </section>
          )}

          {days.map((day) => {
            const dayTasks = all.filter((t) => t.due_date === day);
            return (
              <section key={day} className="mt-6">
                <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">
                  {formatDayHeading(day)}
                </h2>
                <TaskList tasks={dayTasks} allTasks={all} showProject hideDue />
                <AddTaskButton defaultDueDate={day} />
              </section>
            );
          })}

          {later.length > 0 && (
            <section className="mt-6">
              <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">
                Later
              </h2>
              <TaskList tasks={later} allTasks={all} showProject />
            </section>
          )}
        </>
      )}
    </div>
  );
}
