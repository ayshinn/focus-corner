// Spotify integration config. Client ID comes from the build-time env var
// `VITE_SPOTIFY_CLIENT_ID` — if absent, the integration is disabled and
// the connect UI shows a helpful message instead of crashing.

export const SPOTIFY_CLIENT_ID: string =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '';

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Scopes the app uses across playback, search, and library reads. Listed
// here so any single change is visible in one place.
export const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
] as const;

// The redirect URI must match an entry registered in the Spotify dashboard
// exactly. We mirror the deployed BASE_URL so dev and prod both work as
// long as both are registered.
export function spotifyRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${window.location.origin}${base}`;
}

export function isSpotifyConfigured(): boolean {
  return SPOTIFY_CLIENT_ID.trim().length > 0;
}
