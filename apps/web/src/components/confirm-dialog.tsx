'use client';

import clsx from 'clsx';
import { Dialog, DialogContent } from '@/components/ui';

/**
 * App-styled confirmation for destructive actions, replacing the native
 * window.confirm dialogs that ignored the app's design language and rendered
 * wherever the browser felt like. Mirrors the mobile ConfirmSheet.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} hideClose className="max-w-sm p-5">
        <h2 className="mb-1.5 text-base font-semibold">{title}</h2>
        {message ? <p className="mb-5 text-sm text-fg-secondary">{message}</p> : <div className="mb-5" />}
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
            autoFocus
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={clsx(
              'rounded-md bg-p1 px-3.5 py-2 text-sm font-semibold text-white',
              'hover:opacity-90',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
