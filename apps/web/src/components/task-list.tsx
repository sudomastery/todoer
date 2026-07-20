'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { GripVertical, Plus } from 'lucide-react';
import {
  canReorder,
  reorderSortOrders,
  sortTasksBy,
  type SortBy,
  type TaskWithLabels,
} from '@todoer/shared';
import { useReorderTasks } from '@/lib/hooks';
import { TaskItem } from '@/components/task-item';
import { TaskEditor } from '@/components/task-editor';

export function sortTasks(tasks: TaskWithLabels[]): TaskWithLabels[] {
  return sortTasksBy(tasks, 'manual');
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
  sortBy = 'manual',
}: {
  tasks: TaskWithLabels[];
  allTasks: TaskWithLabels[];
  showProject?: boolean;
  hideDue?: boolean;
  emptyMessage?: string;
  sortBy?: SortBy;
}) {
  const reorderMutation = useReorderTasks();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement | null>());

  const topLevel = sortTasksBy(
    tasks.filter((t) => !t.parent_id || !tasks.some((p) => p.id === t.parent_id)),
    sortBy,
  );

  // Any other sort would immediately override a dragged position, so the
  // handles only appear under manual ordering.
  const draggable = canReorder(sortBy) && topLevel.length > 1;

  // Pointer events rather than HTML5 drag and drop: the native API does not
  // fire for touch input at all, so a phone or tablet could never reorder.
  useEffect(() => {
    if (!dragId) return;

    const indexAt = (y: number) => {
      for (let i = 0; i < topLevel.length; i++) {
        const el = rowRefs.current.get(topLevel[i].id);
        if (!el) continue;
        if (y < el.getBoundingClientRect().bottom) return i;
      }
      return topLevel.length - 1;
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      setOverIndex(indexAt(e.clientY));
    };

    const onUp = (e: PointerEvent) => {
      const from = topLevel.findIndex((t) => t.id === dragId);
      const to = indexAt(e.clientY);
      setDragId(null);
      setOverIndex(null);
      if (from === -1) return;
      const updates = reorderSortOrders(topLevel, from, to);
      if (updates.length > 0) reorderMutation.mutate(updates);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragId, topLevel, reorderMutation]);

  if (topLevel.length === 0 && emptyMessage) {
    return <p className="py-6 text-sm text-fg-faint">{emptyMessage}</p>;
  }

  return (
    <div>
      {topLevel.map((task, index) => (
        <div
          key={task.id}
          ref={(el) => {
            rowRefs.current.set(task.id, el);
          }}
          className={clsx(
            'group/drag relative',
            dragId === task.id && 'opacity-40',
            overIndex === index && dragId && dragId !== task.id && 'border-t-2 border-brand',
          )}
        >
          {draggable && (
            <button
              type="button"
              aria-label={`Reorder ${task.content}`}
              // Touch needs the default pan gesture suppressed, otherwise the
              // page scrolls instead of the row moving.
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                e.preventDefault();
                setDragId(task.id);
                setOverIndex(index);
              }}
              className="absolute -left-5 top-3 cursor-grab rounded p-0.5 text-fg-faint opacity-0 hover:text-fg-secondary focus:opacity-100 group-hover/drag:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <TaskItem
            task={task}
            subtasks={sortTasks(allTasks.filter((t) => t.parent_id === task.id))}
            showProject={showProject}
            hideDue={hideDue}
          />
        </div>
      ))}
    </div>
  );
}
