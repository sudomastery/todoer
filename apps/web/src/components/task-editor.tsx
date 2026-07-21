'use client';

import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Hash, X } from 'lucide-react';
import {
  colorHex,
  ensureLabels,
  parseQuickAdd,
  type Priority,
  type TaskWithLabels,
} from '@todoer/shared';
import {
  useCreateSubtasks,
  useCreateTask,
  useProjects,
  useSetTaskLabels,
  useSupabase,
  useUpdateTask,
} from '@/lib/hooks';
import { DueChip, PriorityChip, ProjectPicker, RepeatChip } from '@/components/pickers';
import { TaskComments } from '@/components/task-comments';
import { LabelPicker } from '@/components/pickers';
import { Chip } from '@/components/ui';
import { Tag } from 'lucide-react';
import { useLabels } from '@/lib/hooks';

/**
 * Inline task editor. Without `task` it creates tasks and live-parses
 * quick-add tokens from the text; with `task` it edits fields directly.
 */
export function TaskEditor({
  task,
  defaultProjectId,
  sectionId,
  parentId,
  defaultDueDate,
  onDone,
  autoFocus = true,
  closeOnCreate = false,
}: {
  task?: TaskWithLabels;
  defaultProjectId?: string;
  sectionId?: string | null;
  parentId?: string | null;
  defaultDueDate?: string | null;
  onDone: () => void;
  autoFocus?: boolean;
  /**
   * Dismiss after creating instead of clearing and staying open. The inline
   * composers sit in the list and are meant for typing several tasks in a row,
   * but a dialog covering the app should get out of the way once it is done.
   */
  closeOnCreate?: boolean;
}) {
  const db = useSupabase();
  const createTask = useCreateTask();
  const createSubtasks = useCreateSubtasks();
  const updateTask = useUpdateTask();
  const setTaskLabels = useSetTaskLabels();
  const { data: projects } = useProjects();
  const { data: allLabels } = useLabels();

  const isEdit = !!task;
  const [text, setText] = useState(task?.content ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [saving, setSaving] = useState(false);

  // Subtasks staged while the parent is still being typed. They only exist in
  // the database once the parent does, so they are held here until submit.
  // A subtask cannot itself have children, so this is hidden when parentId is set.
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskText, setSubtaskText] = useState('');
  const canNest = !isEdit && !parentId;

  function addSubtask() {
    const name = subtaskText.trim();
    if (!name) return;
    setSubtasks((prev) => [...prev, name]);
    setSubtaskText('');
  }

  // explicit chip selections override parsed tokens
  const [dueOverride, setDueOverride] = useState<string | null | undefined>(
    isEdit ? task.due_date : undefined,
  );
  const [timeOverride, setTimeOverride] = useState<string | null | undefined>(
    isEdit ? task.due_time : undefined,
  );
  const [recurrenceOverride, setRecurrenceOverride] = useState<string | null | undefined>(
    isEdit ? task.recurrence : undefined,
  );
  const [priorityOverride, setPriorityOverride] = useState<Priority | undefined>(
    isEdit ? task.priority : undefined,
  );
  const [projectOverride, setProjectOverride] = useState<string | undefined>(
    isEdit ? task.project_id : undefined,
  );
  const [labelIdsOverride, setLabelIdsOverride] = useState<string[] | undefined>(
    isEdit ? task.label_ids : undefined,
  );

  const parsed = useMemo(
    () => (isEdit ? null : parseQuickAdd(text)),
    [isEdit, text],
  );

  const parsedProjectId = useMemo(() => {
    if (!parsed?.projectName || !projects) return undefined;
    return projects.find((p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase())?.id;
  }, [parsed, projects]);

  const effDue = dueOverride !== undefined ? dueOverride : (parsed?.due_date ?? defaultDueDate ?? null);
  const effTime = timeOverride !== undefined ? timeOverride : (parsed?.due_time ?? null);
  const effRecurrence =
    recurrenceOverride !== undefined ? recurrenceOverride : (parsed?.recurrence ?? null);
  const effPriority: Priority = priorityOverride ?? parsed?.priority ?? 4;
  const inbox = (projects ?? []).find((p) => p.is_inbox);
  const effProjectId =
    projectOverride ?? parsedProjectId ?? defaultProjectId ?? inbox?.id ?? '';
  const effLabelIds = labelIdsOverride ?? [];
  const effLabels = (allLabels ?? []).filter((l) => effLabelIds.includes(l.id));
  const project = (projects ?? []).find((p) => p.id === effProjectId);

  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        const content = text.trim();
        if (!content) return;
        await updateTask.mutateAsync({
          id: task.id,
          patch: {
            content,
            description: description.trim(),
            due_date: effDue,
            // Cleared alongside the date: a time with no day would never fire.
            due_time: effDue ? effTime : null,
            recurrence: effRecurrence,
            priority: effPriority,
            project_id: effProjectId,
          },
        });
        if (labelIdsOverride) {
          await setTaskLabels.mutateAsync({ task, labelIds: labelIdsOverride });
        }
        onDone();
        return;
      }

      if (!parsed?.content) return;
      const parsedLabels = await ensureLabels(db, parsed.labelNames);
      const created = await createTask.mutateAsync({
        content: parsed.content,
        description: description.trim(),
        project_id: effProjectId,
        section_id: sectionId ?? null,
        parent_id: parentId ?? null,
        priority: effPriority,
        due_date: effDue,
        due_time: effDue ? effTime : null,
        recurrence: effRecurrence,
        label_ids: [...new Set([...parsedLabels.map((l) => l.id), ...effLabelIds])],
      });
      // A name still sitting in the subtask box counts: the user typed it and
      // pressing the main submit should not quietly drop it.
      await createSubtasks.mutateAsync({ parent: created, names: [...subtasks, subtaskText] });
      if (closeOnCreate) {
        onDone();
        return;
      }
      // stay open for rapid entry
      setText('');
      setDescription('');
      setSubtasks([]);
      setSubtaskText('');
      setDueOverride(undefined);
      setTimeOverride(undefined);
      setRecurrenceOverride(undefined);
      setPriorityOverride(undefined);
      setLabelIdsOverride(undefined);
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-strong bg-bg p-3 shadow-sm">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') onDone();
        }}
        placeholder={
          isEdit ? 'Task name' : 'Task name, e.g. Call mom tomorrow 5pm #Family @calls p2'
        }
        className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-fg-faint"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') onDone();
        }}
        placeholder="Description"
        className="mt-1 w-full bg-transparent text-xs outline-none placeholder:text-fg-faint"
      />

      {canNest && (
        <div className="mt-2">
          {subtasks.map((name, i) => (
            <div key={`${name}-${i}`} className="flex items-center gap-2 py-0.5 pl-3 text-xs">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fg-faint" />
              <span className="flex-1 truncate">{name}</span>
              <button
                type="button"
                aria-label={`Remove subtask ${name}`}
                onClick={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
                className="text-fg-faint hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <input
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            onKeyDown={(e) => {
              // Enter adds another subtask rather than saving the task, so a
              // whole checklist can be typed without reaching for the mouse.
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
              }
              if (e.key === 'Escape') onDone();
            }}
            aria-label="Add subtask"
            placeholder="Add subtask"
            // Indented past the bullet so it lines up with the rows above it.
            className="mt-0.5 w-full bg-transparent pl-[26px] text-xs outline-none placeholder:text-fg-faint"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <DueChip
          value={effDue}
          onChange={setDueOverride}
          time={effTime}
          onTimeChange={setTimeOverride}
        />
        <PriorityChip value={effPriority} onChange={setPriorityOverride} />
        <LabelPicker value={effLabelIds} onChange={setLabelIdsOverride}>
          <Chip active={effLabels.length > 0}>
            <Tag className="h-3.5 w-3.5" />
            {effLabels.length > 0 ? effLabels.map((l) => l.name).join(', ') : 'Labels'}
          </Chip>
        </LabelPicker>
        <RepeatChip value={effRecurrence} dueDate={effDue} onChange={setRecurrenceOverride} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border-default pt-3">
        <ProjectPicker value={effProjectId} onChange={setProjectOverride}>
          <Chip>
            <Hash
              className="h-3.5 w-3.5"
              style={project ? { color: colorHex(project.color) } : undefined}
            />
            {project?.name ?? 'Project'}
          </Chip>
        </ProjectPicker>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md bg-bg-hover px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:bg-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || (isEdit ? !text.trim() : !parsed?.content)}
            onClick={submit}
            className={clsx(
              'rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white',
              'hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isEdit ? 'Save' : 'Add task'}
          </button>
        </div>
      </div>

      {isEdit && <TaskComments taskId={task.id} />}
    </div>
  );
}
