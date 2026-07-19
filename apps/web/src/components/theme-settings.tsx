'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ACCENT_THEMES } from '@todoer/shared';
import { getAccentId, setAccent } from '@/lib/accent';
import { Dialog, DialogContent } from '@/components/ui';

export function ThemeSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [accent, setAccentState] = useState('classic');

  useEffect(() => {
    if (open) setAccentState(getAccentId());
  }, [open]);

  function choose(id: string) {
    setAccentState(id);
    setAccent(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Theme" className="max-w-xs p-4">
        <h2 className="mb-1 text-base font-semibold">Theme</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Pick the accent color used across the app. Light and dark mode are in the
          menu next to this option.
        </p>
        <div className="space-y-1">
          {ACCENT_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => choose(t.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-bg-hover"
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: t.primary }}
              />
              {t.name}
              {accent === t.id && <Check className="ml-auto h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
