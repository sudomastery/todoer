'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { TaskWithLabels } from '@todoer/shared';
import { TaskItem } from '@/components/task-item';
import { TaskEditor } from '@/components/task-editor';

export function sortTasks(tasks: TaskWithLabels[]): TaskWithLabels[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function AddTaskButton({
  defaultProjectId,
  sectionId,
  defaultDueDate,
}: {
  defaultProjectId?: string;
  sectionId?: string | null;
  defaultDueDate?: string | null;
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <div className="py-2">
        <TaskEditor
          defaultProjectId={defaultProjectId}
          sectionId={sectionId}
          defaultDueDate={defaultDueDate}
          onDone={() => setAdding(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="group flex w-full items-center gap-2.5 py-2.5 text-sm text-fg-secondary hover:text-brand"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-brand group-hover:bg-brand group-hover:text-white">
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </span>
      Add task
    </button>
  );
}

/**
 * Renders top-level tasks with their subtasks nested underneath.
 * `tasks` should already be filtered to the view; subtasks are pulled
 * from `allTasks` so they follow their parent regardless of filters.
 */
export function TaskList({
  tasks,
  allTasks,
  showProject = false,
  hideDue = false,
  emptyMessage,
}: {
  tasks: TaskWithLabels[];
  allTasks: TaskWithLabels[];
  showProject?: boolean;
  hideDue?: boolean;
  emptyMessage?: string;
}) {
  const topLevel = sortTasks(tasks.filter((t) => !t.parent_id || !tasks.some((p) => p.id === t.parent_id)));

  if (topLevel.length === 0 && emptyMessage) {
    return <p className="py-6 text-sm text-fg-faint">{emptyMessage}</p>;
  }

  return (
    <div>
      {topLevel.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          subtasks={sortTasks(allTasks.filter((t) => t.parent_id === task.id))}
          showProject={showProject}
          hideDue={hideDue}
        />
      ))}
    </div>
  );
}
