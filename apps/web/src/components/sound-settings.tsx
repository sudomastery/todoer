'use client';

import { useEffect, useState } from 'react';
import { Check, Shuffle, Volume2, VolumeX } from 'lucide-react';
import {
  COMPLETION_SOUNDS,
  getSoundPref,
  previewSound,
  setSoundPref,
  type SoundPref,
} from '@/lib/sound';
import { Dialog, DialogContent } from '@/components/ui';

const LABELS: Record<string, string> = {
  off: 'Off',
  random: 'Random',
  pop: 'Pop',
  ding: 'Ding',
  chime: 'Chime',
  tada: 'Tada',
};

export function SoundSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pref, setPref] = useState<SoundPref>('pop');

  useEffect(() => {
    if (open) setPref(getSoundPref());
  }, [open]);

  function choose(next: SoundPref) {
    setPref(next);
    setSoundPref(next);
    if (next !== 'off' && next !== 'random') previewSound(next);
  }

  const options: SoundPref[] = ['off', 'random', ...COMPLETION_SOUNDS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Completion sound" className="max-w-xs p-4">
        <h2 className="mb-1 text-base font-semibold">Completion sound</h2>
        <p className="mb-3 text-sm text-fg-secondary">
          Played when you complete a task. Random picks a different sound each time.
        </p>
        <div className="space-y-1">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => choose(o)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-bg-hover"
            >
              {o === 'off' ? (
                <VolumeX className="h-4 w-4 text-fg-faint" />
              ) : o === 'random' ? (
                <Shuffle className="h-4 w-4 text-fg-secondary" />
              ) : (
                <Volume2 className="h-4 w-4 text-fg-secondary" />
              )}
              {LABELS[o]}
              {pref === o && <Check className="ml-auto h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
