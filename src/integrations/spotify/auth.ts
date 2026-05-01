// Spotify auth code flow with PKCE. Public-client (no secret), entirely
// browser-side. Flow:
//
//   1. connect()   — generate verifier, stash, redirect to /authorize
//   2. consumeCallback() — on return, exchange ?code= + verifier for tokens
//   3. silent refresh    — scheduled at 80% of expires_in
//   4. disconnect()      — drop tokens + cancel refresh
//
// We treat "Spotify isn't configured" (missing client id) as a soft
// failure so the rest of the app still loads.

import {
  SPOTIFY_AUTH_URL,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_SCOPES,
  SPOTIFY_TOKEN_URL,
  isSpotifyConfigured,
  spotifyRedirectUri,
} from './config';
import { generatePkcePair, randomState } from './pkce';
import {
  getTokens,
  isExpired,
  loadTokens,
  setTokens,
  type SpotifyTokens,
} from './store';

const VERIFIER_KEY = 'spotify-pkce-verifier';
const STATE_KEY = 'spotify-pkce-state';
const REFRESH_SKEW_RATIO = 0.2; // refresh when 20% of TTL remains

let refreshTimer: number | null = null;
let initialized = false;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.access_token === 'string' &&
    typeof v.expires_in === 'number' &&
    typeof v.scope === 'string' &&
    typeof v.token_type === 'string'
  );
}

function tokensFromResponse(prev: SpotifyTokens | null, res: TokenResponse): SpotifyTokens {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
    tokenType: res.token_type,
    ...(prev?.profile ? { profile: prev.profile } : {}),
  };
}

async function exchangeCode(code: string, verifier: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: spotifyRedirectUri(),
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
  const data: unknown = await res.json();
  if (!isTokenResponse(data)) throw new Error('Spotify token response malformed');
  return tokensFromResponse(null, data);
}

async function refreshWith(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify refresh failed: ${res.status}`);
  const data: unknown = await res.json();
  if (!isTokenResponse(data)) throw new Error('Spotify refresh response malformed');
  return tokensFromResponse(getTokens(), data);
}

function scheduleRefresh(tokens: SpotifyTokens): void {
  cancelRefresh();
  if (!tokens.refreshToken) return;
  const ttl = tokens.expiresAt - Date.now();
  // Refresh when 20% of TTL remains; never sooner than 30s, never later
  // than the actual expiry.
  const delay = Math.max(30_000, Math.min(ttl - ttl * REFRESH_SKEW_RATIO, ttl - 5_000));
  refreshTimer = window.setTimeout(() => {
    void refreshNow().catch(() => {
      // Refresh failed (revoked token, network blip). Drop tokens so the
      // user is prompted to reconnect rather than the UI silently
      // pretending to be connected.
      setTokens(null);
    });
  }, delay);
}

function cancelRefresh(): void {
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = null;
}

export async function refreshNow(): Promise<SpotifyTokens | null> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;
  const next = await refreshWith(tokens.refreshToken);
  setTokens(next);
  scheduleRefresh(next);
  return next;
}

// Returns a valid access token, refreshing if needed. Returns null when
// not connected or when refresh fails.
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens) return null;
  if (!isExpired(tokens, 30_000)) return tokens.accessToken;
  if (!tokens.refreshToken) return null;
  try {
    const next = await refreshNow();
    return next?.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function connect(): Promise<void> {
  if (!isSpotifyConfigured()) {
    throw new Error('Spotify not configured (set VITE_SPOTIFY_CLIENT_ID).');
  }
  const { verifier, challenge } = await generatePkcePair();
  const state = randomState();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES.join(' '),
    show_dialog: 'false',
  });
  window.location.assign(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
}

export function disconnect(): void {
  cancelRefresh();
  setTokens(null);
}

// Reads ?code= / ?state= / ?error= from the current URL. If a code is
// present, exchanges it and clears the params from the address bar so a
// reload doesn't re-attempt the (now-spent) code.
export async function consumeCallback(): Promise<SpotifyTokens | null> {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (!code && !error) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  // Always strip oauth params from the URL — even on error — so a reload
  // doesn't re-fire the same callback.
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState({}, document.title, url.toString());

  if (error) throw new Error(`Spotify auth error: ${error}`);
  if (!code || !verifier) return null;
  if (state !== expectedState) throw new Error('Spotify auth state mismatch');

  const tokens = await exchangeCode(code, verifier);
  setTokens(tokens);
  scheduleRefresh(tokens);
  return tokens;
}

// Boot-time: hydrate from storage and (re-)schedule refresh. Safe to call
// multiple times; subsequent calls are no-ops.
export function initSpotifyAuth(): void {
  if (initialized) return;
  initialized = true;
  const tokens = loadTokens();
  if (!tokens) return;
  if (isExpired(tokens)) {
    void refreshNow().catch(() => setTokens(null));
  } else {
    scheduleRefresh(tokens);
  }
}
