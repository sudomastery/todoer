import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';

// Task completion sounds. The audio files live in assets/sounds/<name>.wav;
// replace those files (same names) to change the sounds.

export const COMPLETION_SOUNDS = ['pop', 'ding', 'chime', 'tada'] as const;
export type CompletionSound = (typeof COMPLETION_SOUNDS)[number];
export type SoundPref = 'off' | 'random' | CompletionSound;

const KEY = 'todoer.completionSound';
const DEFAULT_PREF: SoundPref = 'pop';

const FILES: Record<CompletionSound, number> = {
  pop: require('../assets/sounds/pop.wav'),
  ding: require('../assets/sounds/ding.wav'),
  chime: require('../assets/sounds/chime.wav'),
  tada: require('../assets/sounds/tada.wav'),
};

let cached: SoundPref | null = null;

export async function getSoundPref(): Promise<SoundPref> {
  if (cached) return cached;
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'off' || v === 'random' || (COMPLETION_SOUNDS as readonly string[]).includes(v ?? '')) {
      cached = v as SoundPref;
      return cached;
    }
  } catch {
    // storage unavailable
  }
  cached = DEFAULT_PREF;
  return cached;
}

export async function setSoundPref(pref: SoundPref): Promise<void> {
  cached = pref;
  try {
    await AsyncStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable
  }
}

export function previewSound(name: CompletionSound): void {
  try {
    const player = createAudioPlayer(FILES[name]);
    player.play();
    setTimeout(() => player.release(), 2000);
  } catch {
    // sound is best-effort
  }
}

export async function playCompletionSound(): Promise<void> {
  const pref = await getSoundPref();
  if (pref === 'off') return;
  const name =
    pref === 'random'
      ? COMPLETION_SOUNDS[Math.floor(Math.random() * COMPLETION_SOUNDS.length)]
      : pref;
  previewSound(name);
}
