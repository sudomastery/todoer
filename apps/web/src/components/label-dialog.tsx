'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check, Tag } from 'lucide-react';
import { COLOR_KEYS, PALETTE, type Label } from '@todoer/shared';
import { useCreateLabel, useUpdateLabel } from '@/lib/hooks';
import { Dialog, DialogContent } from '@/components/ui';

/**
 * Add or rename a label, and pick its color. Labels have always had a color
 * column, but the web UI only ever offered a native prompt for the name, so
 * every label was stuck on the default. Matches the project dialog.
 */
export function LabelDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: Label;
}) {
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();

  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState(label?.color ?? 'charcoal');

  useEffect(() => {
    if (open) {
      setName(label?.name ?? '');
      setColor(label?.color ?? 'charcoal');
    }
  }, [open, label]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (label) {
      await updateLabel.mutateAsync({ id: label.id, patch: { name: trimmed, color } });
    } else {
      await createLabel.mutateAsync({ name: trimmed, color });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={label ? 'Edit label' : 'Add label'} className="max-w-md p-5">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Tag className="h-4 w-4" style={{ color: PALETTE[color]?.hex }} />
          {label ? 'Edit label' : 'Add label'}
        </h2>

        <label className="mb-1 block text-xs font-semibold text-fg-secondary">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={60}
          placeholder="e.g. errands"
          className="mb-4 w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm outline-none focus:border-fg-faint"
        />

        <label className="mb-1 block text-xs font-semibold text-fg-secondary">Color</label>
        <div className="mb-5 grid grid-cols-10 gap-1.5">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              title={PALETTE[key].label}
              aria-label={PALETTE[key].label}
              aria-pressed={color === key}
              onClick={() => setColor(key)}
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{ backgroundColor: PALETTE[key].hex }}
            >
              {color === key && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>

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
            {label ? 'Save' : 'Add'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
