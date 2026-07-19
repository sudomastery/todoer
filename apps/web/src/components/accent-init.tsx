'use client';

import { useEffect } from 'react';
import { applyAccent, getAccentId } from '@/lib/accent';

/** Applies the stored accent theme on first paint; renders nothing. */
export function AccentInit() {
  useEffect(() => {
    applyAccent(getAccentId());
  }, []);
  return null;
}
