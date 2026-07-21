'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Dialog, DialogContent } from '@/components/ui';

/**
 * Single text field in an app-styled dialog, replacing native window.prompt
 * calls. The browser renders those detached from the element that triggered
 * them, so a rename could open in the far corner of the screen.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  fieldLabel,
  initialValue = '',
  placeholder,
  submitLabel,
  maxLength = 120,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fieldLabel: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  maxLength?: number;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="max-w-md p-5">
        <h2 className="mb-4 text-base font-semibold">{title}</h2>

        <label className="mb-1 block text-xs font-semibold text-fg-secondary">{fieldLabel}</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={maxLength}
          placeholder={placeholder}
          className="mb-5 w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm outline-none focus:border-fg-faint"
        />

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
            disabled={!value.trim()}
            onClick={submit}
            className={clsx(
              'rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white',
              'hover:bg-brand-hover disabled:opacity-50',
            )}
          >
            {submitLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
