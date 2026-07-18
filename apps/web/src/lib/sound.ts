'use client';

// Task completion sounds. The audio files live in /public/sounds/<name>.wav;
// replace those files (same names) to change the sounds.

export const COMPLETION_SOUNDS = ['pop', 'ding', 'chime', 'tada'] as const;
export type CompletionSound = (typeof COMPLETION_SOUNDS)[number];
export type SoundPref = 'off' | 'random' | CompletionSound;

const KEY = 'todoer.completionSound';
const DEFAULT_PREF: SoundPref = 'pop';

export function getSoundPref(): SoundPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'off' || v === 'random' || (COMPLETION_SOUNDS as readonly string[]).includes(v ?? '')) {
      return v as SoundPref;
    }
  } catch {
    // storage unavailable
  }
  return DEFAULT_PREF;
}

export function setSoundPref(pref: SoundPref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable
  }
}

export function previewSound(name: CompletionSound): void {
  const audio = new Audio(`/sounds/${name}.wav`);
  audio.volume = 0.6;
  void audio.play().catch(() => {
    // autoplay blocked or file missing; sound is best-effort
  });
}

export function playCompletionSound(): void {
  const pref = getSoundPref();
  if (pref === 'off') return;
  const name =
    pref === 'random'
      ? COMPLETION_SOUNDS[Math.floor(Math.random() * COMPLETION_SOUNDS.length)]
      : pref;
  previewSound(name);
}
