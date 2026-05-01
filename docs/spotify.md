# Spotify integration

`focus-corner` connects to Spotify with a public-client **PKCE** auth-code flow — no client secret, all browser-side. Tokens land in `localStorage` (`spotify-tokens`, schema v1) and silently refresh at ~80% of TTL while the tab is open.

Spec §2 caps the integration at Spotify **Developer Mode** (max 25 allowlisted users). Do not propose pushing it into extended quota / verification.

## What lives where

| File | Role |
| --- | --- |
| `src/integrations/spotify/config.ts` | Env-driven client ID, scopes, redirect URI |
| `src/integrations/spotify/pkce.ts` | RFC 7636 verifier/challenge helpers |
| `src/integrations/spotify/auth.ts` | `connect`, `consumeCallback`, refresh, `disconnect` |
| `src/integrations/spotify/store.ts` | Versioned token persistence + listeners |
| `src/integrations/spotify/api.ts` | `spotifyFetch` wrapper (auth header + 401 retry) |
| `src/integrations/spotify/ui-connect.ts` | Settings drawer connect chip |

## One-time setup (manual)

See `human-handoff.md` in the repo root for the click-by-click. Summary:

1. Register a Spotify Developer app, tick **Web API + Web Playback SDK**.
2. Add redirect URIs: `https://ayshinn.github.io/focus-corner/`, `http://127.0.0.1:5173/focus-corner/`, `http://localhost:5173/focus-corner/`.
3. Copy the Client ID into `.env.local` as `VITE_SPOTIFY_CLIENT_ID=...`.
4. Add allowlisted users via the dashboard's User Management screen (each before they try to connect).
5. For deployed builds, expose the same env var via a GitHub Actions secret.

## Failure modes

- **No client ID** — Connect button is disabled with "not configured".
- **Allowlist miss (403)** — inline message "Account not on the developer allowlist — ask Anthony to add you."
- **Non-Premium account** — playback degrades to bundled default music; inline "Spotify Premium required" message.
- **Refresh fails** — tokens are dropped so the user is prompted to reconnect rather than left in a half-connected state.
- **Network blip on `/me`** — connect succeeds; profile hydrates on next reload.

## Scopes

```
streaming
user-read-email
user-read-private
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
playlist-read-private
playlist-read-collaborative
user-library-read
```

`streaming` is the one Web Playback SDK actually needs; the rest are read scopes the discovery / playback UI uses.
