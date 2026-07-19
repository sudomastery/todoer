import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DISPLAY, type DisplayPrefs } from '@todoer/shared';

// Per-view display preferences, persisted under the same key scheme the web
// app uses in localStorage so behavior matches across platforms.

export function useDisplayPrefs(viewKey: string) {
  const storageKey = `todoer.display.${viewKey}`;
  const [prefs, setPrefs] = useState<DisplayPrefs>(DEFAULT_DISPLAY);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!cancelled && raw) setPrefs({ ...DEFAULT_DISPLAY, ...JSON.parse(raw) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const update = useCallback(
    (patch: Partial<DisplayPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        void AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setPrefs(DEFAULT_DISPLAY);
    void AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  return { prefs, update, reset };
}
