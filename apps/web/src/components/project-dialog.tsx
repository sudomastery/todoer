'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { COLOR_KEYS, PALETTE, type Project } from '@todoer/shared';
import { useCreateProject, useUpdateProject } from '@/lib/hooks';
import { Dialog, DialogContent } from '@/components/ui';

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState(project?.color ?? 'charcoal');
  const [favorite, setFavorite] = useState(project?.is_favorite ?? false);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '');
      setColor(project?.color ?? 'charcoal');
      setFavorite(project?.is_favorite ?? false);
    }
  }, [open, project]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (project) {
      await updateProject.mutateAsync({
        id: project.id,
        patch: { name: trimmed, color, is_favorite: favorite },
      });
    } else {
      await createProject.mutateAsync({ name: trimmed, color, is_favorite: favorite });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={project ? 'Edit project' : 'Add project'} className="max-w-md p-5">
        <h2 className="mb-4 text-base font-semibold">
          {project ? 'Edit project' : 'Add project'}
        </h2>

        <label className="mb-1 block text-xs font-semibold text-fg-secondary">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={120}
          className="mb-4 w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm outline-none focus:border-fg-faint"
        />

        <label className="mb-1 block text-xs font-semibold text-fg-secondary">Color</label>
        <div className="mb-4 grid grid-cols-10 gap-1.5">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={PALETTE[key].label}
              onClick={() => setColor(key)}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: PALETTE[key].hex }}
            >
              {color === key && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <label className="mb-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
            className="accent-brand"
          />
          Add to favorites
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-bg-hover px-3.5 py-2 text-sm font-semibold text-fg-secondary hover:bg-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={submit}
            className={clsx(
              'rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white',
              'hover:bg-brand-hover disabled:opacity-50',
            )}
          >
            {project ? 'Save' : 'Add'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
