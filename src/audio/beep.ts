// Interval-end chime. If the active theme declares a `chimeSrc`, that
// sample plays; otherwise (or on load/play failure) we fall back to the
// Web Audio oscillator beep so the MVP always has audible feedback.

import { getPref, getTheme } from '../theme';

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

interface BeepOptions {
  frequency?: number;
  durationMs?: number;
  volume?: number;
}

export async function beep(options: BeepOptions = {}): Promise<void> {
  const audio = getContext();
  if (!audio) return;

  // Browsers suspend an AudioContext until a user gesture. The pomodoro
  // start button counts as one, so by the time the first interval ends
  // resuming should succeed silently.
  if (audio.state === 'suspended') {
    try {
      await audio.resume();
    } catch {
      return;
    }
  }

  const { frequency = 880, durationMs = 360, volume = 0.18 } = options;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = 'sine';
  osc.frequency.value = frequency;

  // Quick attack + exponential release so it doesn't click.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.05);
}

function playOscillatorChime(): void {
  // Two-note chord-ish blip: high then a perfect fourth above ~150ms later.
  void beep({ frequency: 880, durationMs: 320 });
  window.setTimeout(() => {
    void beep({ frequency: 1175, durationMs: 360 });
  }, 160);
}

function playSample(src: string, volume = 0.5): Promise<boolean> {
  return new Promise((resolve) => {
    const a = new Audio(src);
    a.volume = volume;
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    a.addEventListener('error', () => finish(false), { once: true });
    a.play().then(() => finish(true)).catch(() => finish(false));
  });
}

export function playIntervalEndChime(): void {
  const theme = getTheme(getPref().themeId);
  const src = theme?.chimeSrc;
  if (!src) {
    playOscillatorChime();
    return;
  }
  void playSample(src).then((ok) => {
    if (!ok) playOscillatorChime();
  });
}
