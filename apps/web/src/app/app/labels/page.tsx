'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { colorHex, type Label } from '@todoer/shared';
import { useActiveTasks, useDeleteLabel, useLabels } from '@/lib/hooks';
import { RowSkeleton } from '@/components/loading';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LabelDialog } from '@/components/label-dialog';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
} from '@/components/ui';

export default function LabelsPage() {
  const { data: labels, isLoading } = useLabels();
  const { data: tasks } = useActiveTasks();
  const deleteLabel = useDeleteLabel();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Filters &amp; Labels</h1>
        <IconButton label="Add label" onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mt-6">
        <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">Labels</h2>
        {isLoading ? (
          <RowSkeleton />
        ) : (labels ?? []).length === 0 ? (
          <p className="py-6 text-sm text-fg-faint">
            No labels yet. Add one here or type @name when adding a task.
          </p>
        ) : (
          (labels ?? []).map((label) => {
            const count = (tasks ?? []).filter((t) => t.label_ids.includes(label.id)).length;
            return (
              <div
                key={label.id}
                className="group flex items-center border-b border-border-default hover:bg-bg-hover"
              >
                <Link
                  href={`/app/label/${label.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-2.5 text-sm"
                >
                  <Tag className="h-4 w-4 shrink-0" style={{ color: colorHex(label.color) }} />
                  <span className="truncate">{label.name}</span>
                  <span className="ml-auto text-xs text-fg-faint">{count > 0 ? count : ''}</span>
                </Link>
                <Dropdown>
                  <DropdownTrigger asChild>
                    <button
                      type="button"
                      aria-label="Label options"
                      className="mr-1 hidden rounded p-1 text-fg-faint hover:bg-border-strong group-hover:block"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownTrigger>
                  <DropdownContent align="end">
                    <DropdownItem onSelect={() => setEditing(label)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownItem>
                    <DropdownItem danger onSelect={() => setDeleting(label)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </div>
            );
          })
        )}
      </div>

      <LabelDialog open={adding} onOpenChange={setAdding} />
      <LabelDialog
        // Keyed so the dialog remounts per label and picks up its own values.
        key={editing?.id ?? 'none'}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        label={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        message="Tasks keep their other labels."
        confirmLabel="Delete label"
        onConfirm={() => {
          if (deleting) deleteLabel.mutate(deleting.id);
        }}
      />
    </div>
  );
}
