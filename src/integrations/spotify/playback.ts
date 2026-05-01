// Coordinates the Spotify Web Playback SDK player lifecycle. Owns:
//   - the player instance + device id
//   - a state snapshot fed to whatever UI is rendered
//   - failure mode flagging (non-Premium → revert to default music)
//
// Public surface is small: ensurePlayer / destroyPlayer / subscribePlayback /
// transferToThisDevice / the imperative controls (play/next/seek/...).

import { read, write, type MigrationMap } from '../../storage/versioned';
import { spotifyFetch, SpotifyApiError } from './api';
import { getValidAccessToken, refreshNow } from './auth';
import {
  loadSpotifySdk,
  type SpotifyPlaybackState,
  type SpotifyPlayer,
  type SpotifyTrack,
} from './sdk';

export type PlaybackMode = 'inactive' | 'connecting' | 'ready' | 'no-premium' | 'error';

export interface PlaybackSnapshot {
  mode: PlaybackMode;
  deviceId: string | null;
  errorMessage: string | null;
  track: SpotifyTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  showAlbumArt: boolean;
}

interface PersistedPlayback {
  volume: number;
  showAlbumArt: boolean;
}

const STORAGE_KEY = 'spotify-playback';
const STORAGE_VERSION = 1;
const STORAGE_MIGRATIONS: MigrationMap = {};
const PLAYER_NAME = 'focus-corner';

const DEFAULTS: PlaybackSnapshot = {
  mode: 'inactive',
  deviceId: null,
  errorMessage: null,
  track: null,
  paused: true,
  positionMs: 0,
  durationMs: 0,
  volume: 0.5,
  showAlbumArt: false,
};

function readPersisted(): Partial<PersistedPlayback> {
  const stored = read<unknown>(STORAGE_KEY, STORAGE_VERSION, STORAGE_MIGRATIONS);
  if (!stored || typeof stored !== 'object') return {};
  const v = stored as Record<string, unknown>;
  const out: Partial<PersistedPlayback> = {};
  if (typeof v.volume === 'number') out.volume = v.volume;
  if (typeof v.showAlbumArt === 'boolean') out.showAlbumArt = v.showAlbumArt;
  return out;
}

function persist(snapshot: PlaybackSnapshot): void {
  const value: PersistedPlayback = {
    volume: snapshot.volume,
    showAlbumArt: snapshot.showAlbumArt,
  };
  write(STORAGE_KEY, STORAGE_VERSION, value);
}

let player: SpotifyPlayer | null = null;
let snapshot: PlaybackSnapshot = { ...DEFAULTS, ...readPersisted() };
const listeners = new Set<(s: PlaybackSnapshot) => void>();
let positionTicker: number | null = null;
let lastStateAt = 0;

function emit(): void {
  const copy = { ...snapshot };
  for (const fn of listeners) fn(copy);
}

function patch(p: Partial<PlaybackSnapshot>): void {
  snapshot = { ...snapshot, ...p };
  emit();
  persist(snapshot);
}

function startPositionTicker(): void {
  if (positionTicker !== null) return;
  positionTicker = window.setInterval(() => {
    if (snapshot.paused || snapshot.durationMs === 0) return;
    const elapsed = Date.now() - lastStateAt;
    const next = Math.min(snapshot.durationMs, snapshot.positionMs + elapsed);
    if (next === snapshot.positionMs) return;
    lastStateAt = Date.now();
    snapshot = { ...snapshot, positionMs: next };
    emit();
  }, 1000);
}

function stopPositionTicker(): void {
  if (positionTicker !== null) window.clearInterval(positionTicker);
  positionTicker = null;
}

function applyState(state: SpotifyPlaybackState | null): void {
  if (!state) {
    patch({ track: null, paused: true, positionMs: 0, durationMs: 0 });
    return;
  }
  lastStateAt = Date.now();
  patch({
    track: state.track_window.current_track,
    paused: state.paused,
    positionMs: state.position,
    durationMs: state.duration,
  });
  if (state.paused) stopPositionTicker();
  else startPositionTicker();
}

export async function ensurePlayer(): Promise<SpotifyPlayer | null> {
  if (player) return player;
  const token = await getValidAccessToken();
  if (!token) return null;

  patch({ mode: 'connecting', errorMessage: null });

  const Ctor = await loadSpotifySdk().catch((err: unknown) => {
    patch({
      mode: 'error',
      errorMessage: err instanceof Error ? err.message : 'SDK load failed',
    });
    return null;
  });
  if (!Ctor) return null;

  const instance = new Ctor({
    name: PLAYER_NAME,
    getOAuthToken: (cb) => {
      void getValidAccessToken().then((t) => {
        if (t) cb(t);
      });
    },
    volume: snapshot.volume,
  });

  instance.addListener('ready', (...args: unknown[]) => {
    const data = args[0] as { device_id?: string };
    patch({ mode: 'ready', deviceId: data.device_id ?? null, errorMessage: null });
  });
  instance.addListener('not_ready', (...args: unknown[]) => {
    const data = args[0] as { device_id?: string };
    if (snapshot.deviceId === data.device_id) {
      patch({ mode: 'inactive', deviceId: null });
      stopPositionTicker();
    }
  });
  instance.addListener('player_state_changed', (...args: unknown[]) => {
    applyState(args[0] as SpotifyPlaybackState | null);
  });
  instance.addListener('initialization_error', (...args: unknown[]) => {
    const data = args[0] as { message?: string };
    patch({ mode: 'error', errorMessage: data.message ?? 'Init failed' });
  });
  instance.addListener('authentication_error', () => {
    void refreshNow().catch(() => {
      patch({ mode: 'error', errorMessage: 'Spotify session expired. Reconnect.' });
    });
  });
  instance.addListener('account_error', () => {
    patch({
      mode: 'no-premium',
      errorMessage: 'Spotify Premium required for in-app playback.',
    });
  });
  instance.addListener('playback_error', (...args: unknown[]) => {
    const data = args[0] as { message?: string };
    patch({ errorMessage: data.message ?? 'Playback error' });
  });

  const ok = await instance.connect();
  if (!ok) {
    patch({ mode: 'error', errorMessage: 'Player connect refused' });
    return null;
  }
  player = instance;
  return instance;
}

export function destroyPlayer(): void {
  if (player) {
    player.disconnect();
    player = null;
  }
  stopPositionTicker();
  patch({ mode: 'inactive', deviceId: null, track: null, paused: true });
}

export function getPlayback(): PlaybackSnapshot {
  return { ...snapshot };
}

export function subscribePlayback(fn: (s: PlaybackSnapshot) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Imperative controls — every call no-ops if there is no active player.
export async function play(): Promise<void> {
  await player?.resume().catch(() => {});
}
export async function pause(): Promise<void> {
  await player?.pause().catch(() => {});
}
export async function togglePlay(): Promise<void> {
  await player?.togglePlay().catch(() => {});
}
export async function next(): Promise<void> {
  await player?.nextTrack().catch(() => {});
}
export async function previous(): Promise<void> {
  await player?.previousTrack().catch(() => {});
}
export async function seek(positionMs: number): Promise<void> {
  if (!player) return;
  const clamped = Math.max(0, Math.min(snapshot.durationMs || positionMs, positionMs));
  await player.seek(clamped).catch(() => {});
  lastStateAt = Date.now();
  patch({ positionMs: clamped });
}
export async function setVolume(v: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1, v));
  patch({ volume: clamped });
  await player?.setVolume(clamped).catch(() => {});
}
export function setShowAlbumArt(on: boolean): void {
  patch({ showAlbumArt: on });
}

// Transfer Web API call. Used both for the explicit "play here" button
// and as a one-shot when the player first becomes ready in the app.
export async function transferToThisDevice(autoplay = false): Promise<void> {
  const id = snapshot.deviceId;
  if (!id) return;
  try {
    await spotifyFetch('/me/player', {
      method: 'PUT',
      body: { device_ids: [id], play: autoplay },
      expectNoContent: true,
    });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      patch({ errorMessage: `Transfer failed: ${err.message}` });
    }
  }
}
