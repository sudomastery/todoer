'use client';

import { useActiveTasks, useProjects } from '@/lib/hooks';
import { AddTaskButton, TaskList } from '@/components/task-list';

export default function InboxPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const { data: projects } = useProjects();

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const all = tasks ?? [];
  const inboxTasks = inbox ? all.filter((t) => t.project_id === inbox.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Inbox</h1>
      {isLoading || !inbox ? (
        <p className="py-8 text-sm text-fg-faint">Loading…</p>
      ) : (
        <section className="mt-4">
          <TaskList
            tasks={inboxTasks}
            allTasks={all}
            emptyMessage="Your inbox is empty. Capture a task and sort it later."
          />
          <AddTaskButton defaultProjectId={inbox.id} />
        </section>
      )}
    </div>
  );
}
