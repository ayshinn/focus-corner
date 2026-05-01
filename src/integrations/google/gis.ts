// Google Identity Services (GIS) loader + token client. Browser-side
// OAuth via the implicit token model — no server, no client secret,
// matching spec §2's "no backend" rule.
//
// requestAccessToken({ prompt: '' }) is what gives us silent refresh
// once the user has consented at least once.

import {
  GIS_SCRIPT_SRC,
  GOOGLE_CLIENT_ID,
  GOOGLE_SCOPES,
  isGoogleConfigured,
} from './config';
import {
  getGoogleTokens,
  isGoogleExpired,
  loadGoogleTokens,
  setGoogleTokens,
  type GoogleTokens,
} from './store';

interface TokenClientResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: '' | 'consent' | 'none' }): void;
  callback?: (resp: TokenClientResponse) => void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(opts: {
        client_id: string;
        scope: string;
        callback: (resp: TokenClientResponse) => void;
        prompt?: string;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

let sdkPromise: Promise<GoogleGlobal> | null = null;
let tokenClient: TokenClient | null = null;
let initialized = false;
let refreshTimer: number | null = null;

function loadGis(): Promise<GoogleGlobal> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<GoogleGlobal>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = (): void => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new Error('GIS loaded but oauth2 namespace missing'));
    };
    script.onerror = (): void => reject(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

async function ensureClient(): Promise<TokenClient | null> {
  if (!isGoogleConfigured()) throw new Error('Google not configured (set VITE_GOOGLE_CLIENT_ID).');
  if (tokenClient) return tokenClient;
  const google = await loadGis();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: () => {
      // Per-call callback set in requestToken.
    },
  });
  return tokenClient;
}

function requestToken(prompt: '' | 'consent' = ''): Promise<GoogleTokens> {
  return new Promise<GoogleTokens>((resolve, reject) => {
    void ensureClient().then((client) => {
      if (!client) {
        reject(new Error('Token client unavailable'));
        return;
      }
      client.callback = (resp): void => {
        if (resp.error) {
          reject(new Error(resp.error_description ?? resp.error));
          return;
        }
        if (!resp.access_token || !resp.expires_in) {
          reject(new Error('Google token response malformed'));
          return;
        }
        const tokens: GoogleTokens = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + resp.expires_in * 1000,
          scope: resp.scope ?? GOOGLE_SCOPES,
          ...(getGoogleTokens()?.email ? { email: getGoogleTokens()!.email } : {}),
        };
        setGoogleTokens(tokens);
        scheduleRefresh(tokens);
        resolve(tokens);
      };
      client.requestAccessToken({ prompt });
    }, reject);
  });
}

function scheduleRefresh(tokens: GoogleTokens): void {
  cancelRefresh();
  const ttl = tokens.expiresAt - Date.now();
  // Refresh ~5 minutes before expiry; never sooner than 30s.
  const delay = Math.max(30_000, ttl - 5 * 60 * 1000);
  refreshTimer = window.setTimeout(() => {
    void refreshGoogleNow().catch(() => {
      setGoogleTokens(null);
    });
  }, delay);
}

function cancelRefresh(): void {
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = null;
}

export async function connectGoogle(): Promise<GoogleTokens> {
  return requestToken('consent');
}

export async function refreshGoogleNow(): Promise<GoogleTokens | null> {
  const existing = getGoogleTokens();
  if (!existing) return null;
  return requestToken('');
}

export async function getValidGoogleToken(): Promise<string | null> {
  const tokens = getGoogleTokens();
  if (!tokens) return null;
  if (!isGoogleExpired(tokens)) return tokens.accessToken;
  try {
    const next = await refreshGoogleNow();
    return next?.accessToken ?? null;
  } catch {
    return null;
  }
}

export function disconnectGoogle(): void {
  cancelRefresh();
  const tokens = getGoogleTokens();
  setGoogleTokens(null);
  if (tokens?.accessToken) {
    void loadGis().then((google) => {
      try {
        google.accounts.oauth2.revoke(tokens.accessToken);
      } catch {
        /* best-effort */
      }
    });
  }
}

export function initGoogleAuth(): void {
  if (initialized) return;
  initialized = true;
  const tokens = loadGoogleTokens();
  if (!tokens) return;
  if (isGoogleExpired(tokens)) {
    void refreshGoogleNow().catch(() => setGoogleTokens(null));
  } else {
    scheduleRefresh(tokens);
  }
}
