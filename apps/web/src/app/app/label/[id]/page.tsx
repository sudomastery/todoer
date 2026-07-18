'use client';

import { use } from 'react';
import { Tag } from 'lucide-react';
import { colorHex } from '@todoer/shared';
import { useActiveTasks, useCompletedTasks, useLabels } from '@/lib/hooks';
import { useDisplayPrefs } from '@/lib/display';
import { TaskList } from '@/components/task-list';
import { TaskView } from '@/components/task-view';
import { DisplayMenu } from '@/components/display-menu';

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: labels, isLoading } = useLabels();
  const { data: tasks } = useActiveTasks();
  const { data: completed } = useCompletedTasks();
  const display = useDisplayPrefs(`label.${id}`);

  const label = (labels ?? []).find((l) => l.id === id);
  const all = tasks ?? [];
  const labelTasks = all.filter((t) => t.label_ids.includes(id));
  const labelCompleted = (completed ?? []).filter((t) => t.label_ids.includes(id));

  if (isLoading) return <p className="py-8 text-sm text-fg-faint">Loading…</p>;
  if (!label) return <p className="py-8 text-sm text-fg-secondary">Label not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Tag className="h-6 w-6" style={{ color: colorHex(label.color) }} />
          {label.name}
        </h1>
        <DisplayMenu state={display} />
      </div>
      <div className="mt-4">
        <TaskView
          prefs={display.prefs}
          tasks={labelTasks}
          completedTasks={labelCompleted}
          allTasks={all}
          showProject
          fallback={
            <TaskList
              tasks={labelTasks}
              allTasks={all}
              showProject
              emptyMessage="No active tasks with this label."
            />
          }
        />
      </div>
    </div>
  );
}
