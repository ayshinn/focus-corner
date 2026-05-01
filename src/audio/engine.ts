// Music engine. <audio> element fed through a Web Audio GainNode so we
// can fade and adjust volume independently of the platform mixer. The
// engine deliberately stays UI-agnostic: state changes go through
// `subscribe`, mounted UI in `index.ts` renders against snapshots.

import type { Track } from './manifest';

export interface MusicState {
  trackId: string | null;
  playing: boolean;
  loop: boolean;
  volume: number;
}

const DEFAULT_STATE: MusicState = {
  trackId: null,
  playing: false,
  loop: true,
  volume: 0.6,
};

export interface AudioEngine {
  setTracks(tracks: Track[]): void;
  getTracks(): Track[];
  load(trackId: string): boolean;
  play(): Promise<void>;
  pause(): void;
  toggle(): Promise<void>;
  setVolume(v: number): void;
  setLoop(on: boolean): void;
  getState(): MusicState;
  subscribe(fn: (state: MusicState) => void): () => void;
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export function createAudioEngine(initial: Partial<MusicState> = {}): AudioEngine {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  let state: MusicState = { ...DEFAULT_STATE, ...initial };
  audio.loop = state.loop;
  audio.volume = state.volume;

  let tracks: Track[] = [];
  let trackMap = new Map<string, Track>();
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  const listeners = new Set<(s: MusicState) => void>();

  function emit(): void {
    const snapshot = { ...state };
    for (const fn of listeners) fn(snapshot);
  }

  function update(patch: Partial<MusicState>): void {
    state = { ...state, ...patch };
    emit();
  }

  function ensureContext(): void {
    if (ctx) return;
    const w = window as WebkitWindow;
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return;
    try {
      ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = state.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
    } catch {
      // MediaElementSource throws if the element was already connected
      // elsewhere; ignore and fall back to <audio>.volume only.
      ctx = null;
      gain = null;
    }
  }

  audio.addEventListener('play', () => update({ playing: true }));
  audio.addEventListener('pause', () => update({ playing: false }));
  audio.addEventListener('ended', () => {
    if (!audio.loop) update({ playing: false });
  });

  return {
    setTracks(next) {
      tracks = next.slice();
      trackMap = new Map(tracks.map((t) => [t.id, t]));
    },
    getTracks() {
      return tracks.slice();
    },
    load(trackId) {
      const track = trackMap.get(trackId);
      if (!track) return false;
      audio.src = track.src;
      audio.loop = state.loop;
      update({ trackId, playing: false });
      return true;
    },
    async play() {
      if (!audio.src) return;
      ensureContext();
      if (ctx?.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
      try {
        await audio.play();
      } catch {
        /* autoplay blocked */
      }
    },
    pause() {
      audio.pause();
    },
    async toggle() {
      if (state.playing) audio.pause();
      else await this.play();
    },
    setVolume(v) {
      const clamped = Math.max(0, Math.min(1, v));
      audio.volume = clamped;
      if (gain) gain.gain.value = clamped;
      update({ volume: clamped });
    },
    setLoop(on) {
      audio.loop = on;
      update({ loop: on });
    },
    getState() {
      return { ...state };
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
