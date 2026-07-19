import { useSyncExternalStore, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accentTheme, THEME_PREF_KEY } from '@todoer/shared';

export const light = {
  bg: '#ffffff',
  bgElevated: '#fcfaf8',
  bgPressed: '#f2efed',
  fg: '#202020',
  fgSecondary: '#666666',
  fgFaint: '#999999',
  border: '#eeeeee',
  brand: accentTheme(null).primary,
};

export const dark = {
  bg: '#1e1e1e',
  bgElevated: '#282828',
  bgPressed: '#333333',
  fg: '#ffffff',
  fgSecondary: '#b3b3b3',
  fgFaint: '#808080',
  border: '#333333',
  brand: accentTheme(null).primary,
};

export type Theme = typeof light;

// -- accent theme: tiny external store backed by AsyncStorage --

let accentId = 'classic';
const listeners = new Set<() => void>();

void AsyncStorage.getItem(THEME_PREF_KEY)
  .then((raw) => {
    if (raw && raw !== accentId) {
      accentId = raw;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAccentId(id: string): void {
  accentId = id;
  void AsyncStorage.setItem(THEME_PREF_KEY, id).catch(() => {});
  listeners.forEach((l) => l());
}

export function useAccentId(): string {
  return useSyncExternalStore(subscribe, () => accentId);
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const id = useAccentId();
  const base = scheme === 'dark' ? dark : light;
  const brand = accentTheme(id).primary;
  return brand === base.brand ? base : { ...base, brand };
}

export function useSetAccent(): (id: string) => void {
  return useCallback(setAccentId, []);
}
