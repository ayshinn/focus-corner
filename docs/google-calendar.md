# Google Calendar integration

Browser-only OAuth via **Google Identity Services** (GIS) implicit token model. Public client ID, no server, matching spec §2's "no backend" rule. Tokens land in `localStorage` (`google-tokens`, schema v1) and refresh silently 5 minutes before expiry. Spec §2 caps the integration at **Test User mode** (max 100 testers) — do not propose pushing to verification.

Spec §10 explicitly excludes Gmail and any read scope beyond Calendar. The implementation requests only `https://www.googleapis.com/auth/calendar.readonly`.

## What lives where

| File | Role |
| --- | --- |
| `src/integrations/google/config.ts` | Env-driven client ID, scope, GIS script URL |
| `src/integrations/google/gis.ts` | SDK loader, token client, silent refresh, revoke |
| `src/integrations/google/store.ts` | Versioned token persistence + listeners |
| `src/integrations/google/calendar.ts` | `listEvents` + day/range helpers, raw fetch wrapper |
| `src/integrations/google/ui-connect.ts` | Integrations row in the settings drawer |
| `src/calendar/index.ts` | Today's-events floating card + topbar countdown pill |

## One-time setup (manual)

See `human-handoff.md` for click-by-click. Summary:

1. Cloud project + enable Calendar API.
2. OAuth consent screen → External, **Testing** publishing status, scope `calendar.readonly`, add your account as a test user.
3. OAuth client ID (Web) with JS origins for prod + dev.
4. Drop the client ID into `.env.local` as `VITE_GOOGLE_CLIENT_ID=...`.

## Failure modes

- **No client ID** — Connect button disabled, "not configured" status.
- **Not in test-user list (403)** — calendar pill: "Calendar access forbidden — check test-user list."
- **Quota / 429** — calendar pill: "Calendar quota — try again in a minute."
- **401 mid-session** — silent refresh retries once; on failure the token is dropped and the user is prompted to reconnect.
- **Tab hidden** — periodic refetch is skipped; resumes on focus + immediate refetch.
