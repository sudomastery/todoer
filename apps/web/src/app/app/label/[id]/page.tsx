'use client';

import { use } from 'react';
import { Tag } from 'lucide-react';
import { colorHex } from '@todoer/shared';
import { useActiveTasks, useLabels } from '@/lib/hooks';
import { TaskList } from '@/components/task-list';

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: labels, isLoading } = useLabels();
  const { data: tasks } = useActiveTasks();

  const label = (labels ?? []).find((l) => l.id === id);
  const all = tasks ?? [];
  const labelTasks = all.filter((t) => t.label_ids.includes(id));

  if (isLoading) return <p className="py-8 text-sm text-fg-faint">Loading…</p>;
  if (!label) return <p className="py-8 text-sm text-fg-secondary">Label not found.</p>;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Tag className="h-6 w-6" style={{ color: colorHex(label.color) }} />
        {label.name}
      </h1>
      <div className="mt-4">
        <TaskList
          tasks={labelTasks}
          allTasks={all}
          showProject
          emptyMessage="No active tasks with this label."
        />
      </div>
    </div>
  );
}
