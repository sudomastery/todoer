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

// Each Audio element is created once and reused. Building a fresh Audio()
// per play meant the browser had to fetch and decode the .wav from scratch
// before every single completion, which showed up as a noticeable delay
// between the checkmark and the sound. Preloading here means that work
// happens once, up front, instead of on the critical path of every toggle.
const audioCache = new Map<CompletionSound, HTMLAudioElement>();

function getAudio(name: CompletionSound): HTMLAudioElement {
  let audio = audioCache.get(name);
  if (!audio) {
    audio = new Audio(`/sounds/${name}.wav`);
    audio.preload = 'auto';
    audioCache.set(name, audio);
  }
  return audio;
}

if (typeof window !== 'undefined') {
  for (const name of COMPLETION_SOUNDS) getAudio(name);
}

export function previewSound(name: CompletionSound): void {
  const audio = getAudio(name);
  audio.volume = 0.6;
  try {
    audio.currentTime = 0;
  } catch {
    // not loaded yet; play() below will still start from the beginning
  }
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
