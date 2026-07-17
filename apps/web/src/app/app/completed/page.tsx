'use client';

import { format, parseISO } from 'date-fns';
import { useCompletedTasks } from '@/lib/hooks';
import { TaskItem } from '@/components/task-item';

export default function CompletedPage() {
  const { data: tasks, isLoading } = useCompletedTasks();
  const all = tasks ?? [];

  const byDay = new Map<string, typeof all>();
  for (const t of all) {
    const day = t.completed_at ? format(parseISO(t.completed_at), 'yyyy-MM-dd') : 'unknown';
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Completed</h1>

      {isLoading ? (
        <p className="py-8 text-sm text-fg-faint">Loading…</p>
      ) : all.length === 0 ? (
        <p className="py-8 text-sm text-fg-faint">Nothing completed yet. Go check something off!</p>
      ) : (
        [...byDay.entries()].map(([day, dayTasks]) => (
          <section key={day} className="mt-6">
            <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">
              {day === 'unknown' ? 'Earlier' : format(parseISO(day), 'EEE MMM d')}
            </h2>
            {dayTasks.map((t) => (
              <TaskItem key={t.id} task={t} completedView showProject />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
