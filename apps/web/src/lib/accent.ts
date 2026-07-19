'use client';

import { accentTheme, THEME_PREF_KEY } from '@todoer/shared';

export function getAccentId(): string {
  if (typeof window === 'undefined') return 'classic';
  return localStorage.getItem(THEME_PREF_KEY) ?? 'classic';
}

/** Applies the accent as CSS variable overrides on the root element. */
export function applyAccent(id: string): void {
  const t = accentTheme(id);
  const s = document.documentElement.style;
  if (id === 'classic') {
    for (const v of ['--color-brand', '--color-brand-hover', '--color-brand-light', '--bg-active']) {
      s.removeProperty(v);
    }
    return;
  }
  s.setProperty('--color-brand', t.primary);
  s.setProperty('--color-brand-hover', t.hover);
  s.setProperty('--color-brand-light', `color-mix(in oklab, ${t.primary} 10%, white)`);
  s.setProperty('--bg-active', `color-mix(in oklab, ${t.primary} 14%, var(--bg))`);
}

export function setAccent(id: string): void {
  localStorage.setItem(THEME_PREF_KEY, id);
  applyAccent(id);
}
