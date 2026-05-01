// Tiny fetch wrapper for the Spotify Web API. Adds the bearer header,
// refreshes once on 401, and parses JSON. Anything more than this lives
// in feature modules (playback, search, playlists).

import { SPOTIFY_API_BASE } from './config';
import { getValidAccessToken, refreshNow } from './auth';

export class SpotifyApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'SpotifyApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  // Some endpoints (e.g. transfer playback) return 204 No Content.
  expectNoContent?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doFetch<T>(token: string, path: string, opts: RequestOptions): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await fetch(buildUrl(path, opts.query), init);
  if (!res.ok) {
    let message = `Spotify ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      /* ignore */
    }
    throw new SpotifyApiError(res.status, message);
  }
  if (opts.expectNoContent || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function spotifyFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyApiError(401, 'Not connected to Spotify');
  try {
    return await doFetch<T>(token, path, opts);
  } catch (err) {
    if (err instanceof SpotifyApiError && err.status === 401) {
      const refreshed = await refreshNow().catch(() => null);
      if (refreshed?.accessToken) {
        return doFetch<T>(refreshed.accessToken, path, opts);
      }
    }
    throw err;
  }
}

// ----- typed helpers used across playback/discovery ------------------

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  product: 'premium' | 'free' | 'open' | string;
}

export function getMe(): Promise<SpotifyUserProfile> {
  return spotifyFetch<SpotifyUserProfile>('/me');
}
