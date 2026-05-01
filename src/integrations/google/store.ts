// Google access-token store. GIS uses a token-model flow (not auth code
// + refresh token), so we keep only the access token and re-request a
// new one silently when it expires.

import { read, write, clear, type MigrationMap } from '../../storage/versioned';

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number;
  scope: string;
  email?: string;
}

const KEY = 'google-tokens';
const VERSION = 1;
const MIGRATIONS: MigrationMap = {};

const listeners = new Set<(tokens: GoogleTokens | null) => void>();
let cached: GoogleTokens | null = null;

function emit(): void {
  for (const fn of listeners) fn(cached);
}

export function loadGoogleTokens(): GoogleTokens | null {
  cached = read<GoogleTokens>(KEY, VERSION, MIGRATIONS);
  return cached;
}

export function getGoogleTokens(): GoogleTokens | null {
  return cached;
}

export function setGoogleTokens(tokens: GoogleTokens | null): void {
  cached = tokens;
  if (tokens) write(KEY, VERSION, tokens);
  else clear(KEY);
  emit();
}

export function patchGoogleTokens(patch: Partial<GoogleTokens>): void {
  if (!cached) return;
  setGoogleTokens({ ...cached, ...patch });
}

export function subscribeGoogleTokens(fn: (tokens: GoogleTokens | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isGoogleExpired(tokens: GoogleTokens, skewMs = 30_000): boolean {
  return Date.now() >= tokens.expiresAt - skewMs;
}
