'use client';

import Link from 'next/link';
import { MoreHorizontal, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { colorHex } from '@todoer/shared';
import { useActiveTasks, useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '@/lib/hooks';
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
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Filters &amp; Labels</h1>
        <IconButton
          label="Add label"
          onClick={() => {
            const name = prompt('Label name');
            if (name?.trim()) createLabel.mutate({ name: name.trim() });
          }}
        >
          <Plus className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="mt-6">
        <h2 className="border-b border-border-default pb-1.5 text-sm font-semibold">Labels</h2>
        {isLoading ? (
          <p className="py-6 text-sm text-fg-faint">Loading…</p>
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
                    <DropdownItem
                      onSelect={() => {
                        const name = prompt('Rename label', label.name);
                        if (name?.trim())
                          updateLabel.mutate({ id: label.id, patch: { name: name.trim() } });
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Rename
                    </DropdownItem>
                    <DropdownItem
                      danger
                      onSelect={() => {
                        if (confirm(`Delete label "${label.name}"?`)) deleteLabel.mutate(label.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
