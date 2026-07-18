'use client';

import { useActiveTasks, useCompletedTasks, useProjects } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/display';
import { AddTaskButton, TaskList } from '@/components/task-list';
import { TaskView } from '@/components/task-view';
import { DisplayMenu } from '@/components/display-menu';

export default function InboxPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const { data: completed } = useCompletedTasks();
  const { data: projects } = useProjects();
  const display = useDisplayPrefs('inbox');

  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const all = tasks ?? [];
  const inboxTasks = inbox ? all.filter((t) => t.project_id === inbox.id) : [];
  const inboxCompleted = inbox ? (completed ?? []).filter((t) => t.project_id === inbox.id) : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox</h1>
        <DisplayMenu state={display} hideGroupProject />
      </div>
      {isLoading || !inbox ? (
        <p className="py-8 text-sm text-fg-faint">Loading…</p>
      ) : (
        <section className="mt-4">
          <TaskView
            prefs={display.prefs}
            tasks={inboxTasks}
            completedTasks={inboxCompleted}
            allTasks={all}
            fallback={
              <TaskList
                tasks={inboxTasks}
                allTasks={all}
                emptyMessage="Your inbox is empty. Capture a task and sort it later."
              />
            }
          />
          <AddTaskButton defaultProjectId={inbox.id} />
        </section>
      )}
    </div>
  );
}
