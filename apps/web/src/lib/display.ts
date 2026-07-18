'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_DISPLAY, type DisplayPrefs } from '@todoer/shared';

export interface DisplayState {
  prefs: DisplayPrefs;
  update: (patch: Partial<DisplayPrefs>) => void;
  reset: () => void;
}

/** Per-view display preferences, persisted in localStorage. */
export function useDisplayPrefs(viewKey: string): DisplayState {
  const storageKey = `todoer.display.${viewKey}`;
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPrefs({ ...DEFAULT_DISPLAY, ...JSON.parse(raw) });
      else setPrefs(DEFAULT_DISPLAY);
    } catch {
      setPrefs(DEFAULT_DISPLAY);
    }
  }, [storageKey]);

  function update(patch: Partial<DisplayPrefs>) {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable; prefs stay in-memory for the session
      }
      return next;
    });
  }

  function reset() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setPrefs(DEFAULT_DISPLAY);
  }

  return { prefs, update, reset };
}
