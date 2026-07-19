'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  Hash,
  MessageSquareText,
  Pencil,
  Plus,
  Repeat,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  colorHex,
  describeRecurrence,
  formatDue,
  isOverdue,
  isToday,
  PRIORITY_COLORS,
  type Priority,
  type TaskWithLabels,
} from '@todoer/shared';
import {
  useCompleteTask,
  useDeleteTask,
  useLabels,
  useProjects,
  useUncompleteTask,
  useUpdateTask,
} from '@/lib/hooks';
import { DuePicker } from '@/components/pickers';
import { TaskEditor } from '@/components/task-editor';
import { IconButton } from '@/components/ui';

export function TaskCheckbox({
  priority,
  checked,
  onToggle,
}: {
  priority: Priority;
  checked: boolean;
  onToggle: () => void;
}) {
  const color = priority < 4 ? PRIORITY_COLORS[priority] : undefined;
  return (
    <button
      type="button"
      aria-label={checked ? 'Uncomplete task' : 'Complete task'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
        if (!checked) e.currentTarget.classList.add('check-pop');
      }}
      className={clsx(
        'group/check mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
        checked && 'border-transparent',
      )}
      style={{
        borderColor: checked ? undefined : (color ?? 'var(--fg-faint)'),
        backgroundColor: checked
          ? (color ?? 'var(--fg-faint)')
          : priority < 4
            ? `${color}18`
            : undefined,
      }}
    >
      <Check
        className={clsx(
          'h-3 w-3 transition-opacity',
          checked ? 'text-white opacity-100' : 'opacity-0 group-hover/check:opacity-100',
        )}
        strokeWidth={3}
        style={{ color: checked ? 'white' : color ?? 'var(--fg-faint)' }}
      />
    </button>
  );
}

export function TaskItem({
  task,
  subtasks = [],
  showProject = false,
  hideDue = false,
  completedView = false,
  card = true,
}: {
  task: TaskWithLabels;
  subtasks?: TaskWithLabels[];
  showProject?: boolean;
  hideDue?: boolean;
  completedView?: boolean;
  /** Rounded card style; false renders a flat divider row (used for subtasks). */
  card?: boolean;
}) {
  const completeTask = useCompleteTask();
  const uncompleteTask = useUncompleteTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();

  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const project = (projects ?? []).find((p) => p.id === task.project_id);
  const taskLabels = (labels ?? []).filter((l) => task.label_ids.includes(l.id));
  const overdue = task.due_date && isOverdue(task.due_date);
  const dueToday = task.due_date && isToday(task.due_date);

  if (editing) {
    return (
      <div className={card ? 'mb-2' : 'border-b border-border-default py-2 last:border-b-0'}>
        <TaskEditor task={task} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        card
          ? 'mb-2 rounded-xl border border-border-default bg-bg-card px-3 shadow-sm transition-colors hover:border-border-strong'
          : 'border-b border-border-default last:border-b-0',
      )}
    >
      <div className="group flex items-start gap-2.5 py-2.5">
        {subtasks.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={clsx('mt-1 hidden w-4 text-fg-faint hover:text-fg md:block', card ? '-ml-1' : '-ml-6')}
            aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : null}

        <TaskCheckbox
          priority={task.priority}
          checked={task.is_completed}
          onToggle={() =>
            task.is_completed ? uncompleteTask.mutate(task.id) : completeTask.mutate(task)
          }
        />

        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => !completedView && setEditing(true)}>
          <div
            className={clsx(
              'text-sm leading-snug',
              task.is_completed && 'text-fg-faint line-through',
            )}
          >
            {task.content}
          </div>

          {task.description && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-fg-faint">
              <MessageSquareText className="h-3 w-3 shrink-0" />
              <span className="truncate">{task.description}</span>
            </div>
          )}

          {(task.due_date || taskLabels.length > 0 || showProject) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {task.due_date && !hideDue && (
                <span
                  className={clsx(
                    'flex items-center gap-1',
                    overdue ? 'text-p1' : dueToday ? 'text-green-600' : 'text-fg-secondary',
                  )}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDue(task.due_date, task.due_time)}
                  {task.recurrence && (
                    <span className="flex items-center gap-0.5">
                      <Repeat className="h-3 w-3" />
                      {describeRecurrence(task.recurrence)}
                    </span>
                  )}
                </span>
              )}
              {taskLabels.map((l) => (
                <span key={l.id} className="flex items-center gap-1 text-fg-secondary">
                  <Tag className="h-3 w-3" style={{ color: colorHex(l.color) }} />
                  {l.name}
                </span>
              ))}
              {showProject && project && (
                <span className="ml-auto flex items-center gap-1 text-fg-faint">
                  {project.name}
                  <Hash className="h-3 w-3" style={{ color: colorHex(project.color) }} />
                </span>
              )}
            </div>
          )}
        </div>

        {!completedView && (
          <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <IconButton label="Edit" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <DuePicker
              value={task.due_date}
              onChange={(d) => updateTask.mutate({ id: task.id, patch: { due_date: d } })}
            >
              <button
                type="button"
                aria-label="Set due date"
                className="rounded-md p-1.5 text-fg-faint hover:bg-bg-hover hover:text-fg-secondary"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </DuePicker>
            {!task.parent_id && (
              <IconButton label="Add subtask" onClick={() => setAddingSubtask(true)}>
                <Plus className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton
              label="Delete"
              onClick={() => {
                if (confirm(`Delete "${task.content}"?`)) deleteTask.mutate(task.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        )}

        {task.priority < 4 && (
          <Flag
            className="mt-1 h-3.5 w-3.5 shrink-0 group-hover:hidden"
            style={{ color: PRIORITY_COLORS[task.priority] }}
            fill={PRIORITY_COLORS[task.priority]}
          />
        )}
      </div>

      {expanded && subtasks.length > 0 && (
        <div className="ml-7 border-t border-border-default">
          {subtasks.map((st) => (
            <TaskItem key={st.id} task={st} hideDue={hideDue} card={false} />
          ))}
        </div>
      )}

      {addingSubtask && (
        <div className="ml-7 pb-2">
          <TaskEditor
            defaultProjectId={task.project_id}
            parentId={task.id}
            onDone={() => setAddingSubtask(false)}
          />
        </div>
      )}
    </div>
  );
}
