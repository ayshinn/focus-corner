// Spotify token state. Persisted via the versioned helper so a token blob
// from an older schema migrates forward instead of corrupting silently.
//
// Tokens live in localStorage. Spec §2 is explicit: no server-side
// secrets, browser-only OAuth. Refresh happens silently at 80% TTL via
// `scheduleRefresh` while the tab is open.

import { read, write, clear, type MigrationMap } from '../../storage/versioned';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
  tokenType: string;
  // Optional profile snapshot — saved alongside tokens so the connect
  // chip can show "connected as <display_name>" without an extra call
  // on every load.
  profile?: { id: string; displayName: string; product: 'premium' | 'free' | 'open' | string };
}

const KEY = 'spotify-tokens';
const VERSION = 1;
const MIGRATIONS: MigrationMap = {};

const listeners = new Set<(tokens: SpotifyTokens | null) => void>();
let cached: SpotifyTokens | null = null;

function emit(): void {
  for (const fn of listeners) fn(cached);
}

export function loadTokens(): SpotifyTokens | null {
  cached = read<SpotifyTokens>(KEY, VERSION, MIGRATIONS);
  return cached;
}

export function getTokens(): SpotifyTokens | null {
  return cached;
}

export function setTokens(tokens: SpotifyTokens | null): void {
  cached = tokens;
  if (tokens) write(KEY, VERSION, tokens);
  else clear(KEY);
  emit();
}

export function patchTokens(patch: Partial<SpotifyTokens>): void {
  if (!cached) return;
  setTokens({ ...cached, ...patch });
}

export function subscribeTokens(fn: (tokens: SpotifyTokens | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isExpired(tokens: SpotifyTokens, skewMs = 0): boolean {
  return Date.now() >= tokens.expiresAt - skewMs;
}
