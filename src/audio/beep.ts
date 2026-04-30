// Placeholder interval-end chime. Web Audio oscillator so the MVP has
// audible feedback without bundling assets. Phase 2 swaps this out for
// theme-matched sample chimes (see step 28).

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

export function playIntervalEndChime(): void {
  // Two-note chord-ish blip: high then a perfect fourth above ~150ms later.
  void beep({ frequency: 880, durationMs: 320 });
  window.setTimeout(() => {
    void beep({ frequency: 1175, durationMs: 360 });
  }, 160);
}
