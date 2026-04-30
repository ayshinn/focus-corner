# focus-corner — Full Spec

> Status: design phase. No code written.
> Repo: `focus-corner`. URL: `https://ayshinn.github.io/focus-corner/`.
> Author: Anthony Shinn. Last updated 2026-04-29.

---

## 1. Vision

Personal aesthetic workspace dashboard. Browser-based, hosted free on GitHub Pages.
Loosely inspired by LifeAt, but not a clone. Centers on tools that matter to me:
pomodoro timer, todo list, ambient backdrop, music control. Theme-driven aesthetic.
Optional Spotify + Google Calendar integrations enrich the experience but the site
must work without them.

**Primary user**: me. **Secondary**: 5–10 friends who I'll allowlist on Spotify dev app.
Not aiming for public launch; verification overhead is intentionally avoided.

**Anti-goals**: account systems, server-side anything, mobile-first, kitchen-sink
LifeAt feature parity, gamification.

---

## 2. Constraints (GitHub Pages free tier)

- Static only. No backend, no env secrets, no DB.
- 1GB repo, 100GB/mo bandwidth, 10 builds/hr.
- HTTPS default → enables `Notification`, service workers, PWA, Wake Lock.
- No CORS proxy → third-party APIs must allow browser CORS or be keyless.
- All persistent state lives in user's browser (localStorage / IndexedDB).
- Cross-device sync = nice-to-have, deferred. Likely Gist-token pattern if added.
- Domain: `https://ayshinn.github.io/focus-corner/`. Custom domain not planned.

---

## 3. Audience & Sharing Model

- Personal-only by default. Shared w/ ≤10 friends.
- Spotify integration: stay in **Spotify Developer Mode**, allowlist friends' accounts
  (max 25, plenty of headroom). No Extended Quota request.
- Google Calendar integration: stay in **Test User mode** (max 100), add friends as
  test users as needed. No Google verification.
- Each visitor uses their own Spotify / Google. Tokens never shared. Site is just
  a static frontend — no central account system.

---

## 4. Themes

Theme picker w/ 5 themes. Each has **day** and **night** variant (similar to light/dark).
Theme controls: backdrop scene, color tokens, font choices, accent, ambient default music.

| Theme        | Day variant                          | Night variant                       |
|--------------|--------------------------------------|-------------------------------------|
| Minimal      | Clean light, soft shadows, sans      | Dark gray base, low contrast accent |
| Cozy Dorm    | Warm beige, lamp lighting, plants    | Dim lamp, string lights, fireplace  |
| Library      | Sunlit window, wood, parchment       | Candlelit shelves, fireplace        |
| Central Park | Daylight trees, path, joggers        | Lit lamps, fireflies, soft hum      |
| Code Terminal| Light terminal, mono fonts, gridlines| Black bg, neon CRT glow, scanlines  |

**Backdrops** are static video files (`.mp4`/`.webm`) bundled in repo, OR pure CSS/JS
animated scenes. No YouTube embeds for backdrops (avoid third-party UI overlays).
Keep video files small — target <10MB each, total backdrop assets <60MB.

**Default theme**: Minimal (loads instantly even before user picks).

**Theme persistence**: localStorage `theme` + `themeVariant` ('day'|'night'). User can
toggle variant manually OR set 'auto' to follow `prefers-color-scheme`.

**Open**: hand-painted CSS scenes vs sourced free-license video — decide per theme
during build. Pexels / Coverr / Pixabay are go-tos for free video.

---

## 5. Features

### 5.1 Core (MVP and beyond)

#### Pomodoro Timer
- Default: 25 work / 5 short break / 15 long break (every 4 cycles).
- All durations user-configurable in settings, persisted localStorage.
- Manual click to start next interval (no auto-advance).
- Sound on interval end. Bundled chime files, theme-matched if feasible
  (e.g. terminal theme = beep, library theme = soft bell).
- Browser `Notification` permission requested on first start; fallback in-page toast
  if denied.
- Tab title shows live countdown: `25:00 — Focus`.
- **Not task-bound**: timer is a clock, decoupled from todo list.
- Tracks sessions per day → fed into Session Log widget (Tier 2).
- Wake Lock API engaged during work intervals (screen stays on).

#### Todo List
- Two columns: **Today**, **Tomorrow**.
- Drag-and-drop reorder within and between columns.
- Add via input + Enter. Edit by clicking item. Mark done w/ checkbox.
- Done items strike through, drop to bottom of column, auto-clear after 24h
  (configurable).
- Top item of **Today** = "current task," displayed prominently elsewhere
  (see Current Task Display).
- Tomorrow column items auto-roll to Today at local midnight.
- Persistence: localStorage. Schema versioned for future migrations.

#### Aesthetic Backdrop
- Bound to selected theme. Day/night variant swaps backdrop accordingly.
- Static video loop or CSS/JS scene. Muted by default (audio handled separately).
- User picks theme; backdrop is not independently switchable.
- Performance: pause backdrop when tab hidden (Page Visibility API).

#### Music Control
- Two modes:
  1. **Default music**: 3 bundled audio tracks (lofi-style, royalty-free).
     Picker UI lets user choose track. Loops by default.
  2. **Spotify (Premium only)**: full custom controls via Web Playback SDK.
- Spotify overrides default music when connected and active.
- Spotify default playlist on first connect: a "Lofi Fruits"-style playlist
  (TBD: pick a stable public playlist URI).
- Custom UI (not embedded widget): play/pause, skip prev/next, scrub bar,
  volume, current track, small/hidden album art (toggleable show), playlist
  picker, search, queue view, transfer-to-this-device button.
- Hotkeys: space (play/pause), `[` `]` (prev/next), `-` `=` (volume).

#### Clock
- Local time, large, glanceable. 12h/24h toggle. Date below.
- Single timezone (local). Multi-tz deferred.

#### Current Task Display
- Shows top item of Today todo column.
- Updates live as todo list changes.
- Big text, theme-styled. Subtle when no task.

#### Theme Switcher
- Compact UI in sidebar or settings panel: 5 theme cards, each w/ tiny preview.
- Day/Night toggle separate.

### 5.2 Nice-to-have (post-MVP, prioritized)

| # | Feature              | Notes                                                        |
|---|----------------------|--------------------------------------------------------------|
| 1 | Hotkeys for everything | `?` opens cheatsheet. Cmd-style palette optional later.    |
| 2 | Session log          | Daily focus minutes. Calendar-grid view. Export CSV.         |
| 3 | Stats display        | Weekly streak, total focus hrs, sessions completed.          |
| 4 | Sticky notes         | Free-position drag, persistent. Markdown-lite. Theme-styled. |
| 5 | Weather widget       | Open-Meteo API (keyless). Geolocation prompt or manual city. |
| 6 | Quote / intention    | Daily quote from local JSON, OR user types intention each day.|
| 7 | Habit tracker        | Daily checkboxes, last-30-days dot grid.                     |

### 5.3 Integrations

#### Spotify (Premium)
- Auth: Authorization Code w/ PKCE. Redirect URI = site root.
- Token + refresh token in localStorage. Silent refresh on load.
- Web Playback SDK loaded after connect. Browser tab becomes a Spotify Connect device.
- Scopes: `streaming user-read-email user-read-private user-read-playback-state
  user-modify-playback-state playlist-read-private user-library-read`.
- Disconnect button clears tokens.
- Failure modes: non-Premium account → show "Premium required" message, fall back
  to default music. Allowlist miss → show "Ask Anthony to add you" message.

#### Google Calendar
- Auth: GIS (Google Identity Services) token model.
- Scope: `https://www.googleapis.com/auth/calendar.readonly`.
- Read-only. Today view default. Toggle to week view if implementation simple.
- Primary calendar only (multi-calendar deferred).
- Event click → in-site detail panel w/ "Open in Google Calendar" link. If panel
  proves fiddly, fall back to direct new-tab open.
- Token expiry 1hr; silent re-auth via GIS prompt suppressed when possible.
- Failure modes: not signed in → show connect button. Quota / network error →
  graceful "Calendar unavailable" pill.

#### Gmail — **explicitly excluded.** Distraction outweighs benefit.

---

## 6. Layout & UX

- **Desktop-only.** Min viewport 1280×720. No mobile responsiveness required for MVP.
- **Single dashboard**, no routing.
- **Sidebar (left, narrow)** + **main area (full bleed backdrop)**.
- Widgets in main area at fixed positions per layout. Only **sticky notes** are
  drag-positionable.
- Sidebar contents (TBD, candidates):
  - Theme switcher
  - Day/night toggle
  - Pomodoro mini-controls (when active)
  - Connect Spotify / Connect Google buttons
  - Settings gear
  - Stats summary
  - Maybe tabs (Settings / Stats / Help) — to be designed.
- Top bar: clock + current task + (if connected) next calendar event countdown.
- Floating cards: pomodoro timer, todo list, music control, calendar — over backdrop
  w/ subtle blur/opacity to keep backdrop visible.
- Hotkey-friendly but not hotkey-required. Mouse fully supported.
- "Focus mode" toggle: hides all widgets except pomodoro + clock. Backdrop full-bleed.

**Open**: exact widget grid layout; whether sidebar collapses; whether floating cards
are user-sizable. Defer to design pass before coding.

---

## 7. Tech Stack (recommendations, all overridable)

| Concern        | Pick                              | Reason                                     |
|----------------|-----------------------------------|--------------------------------------------|
| Build          | Vite                              | Matches nonogram repo. Fast HMR.           |
| Language       | TypeScript                        | Strict mode + noUncheckedIndexedAccess.    |
| Framework      | None (vanilla TS) OR Solid        | Vanilla matches your style; Solid if reactivity grows hairy. |
| CSS            | Hand-written + CSS custom props   | Theme tokens fit naturally; no Tailwind tax. |
| Tests          | Vitest                            | Already known.                             |
| Drag/drop      | Vanilla Pointer Events            | Light, no dep.                             |
| Markdown       | `marked` (if sticky notes need it) | Tiny, no dep tree.                        |
| Icons          | Lucide via inline SVG sprite      | Free, consistent.                          |
| Audio          | HTML5 `<audio>` + Web Audio API   | Mix layers if ambient mixer added.         |
| Spotify        | Web Playback SDK + manual PKCE    | No SDK helper needed.                      |
| Google         | `@googleapis/calendar` types only + raw fetch | Avoid heavy `gapi` client.       |

**PWA**: deferred. Add service worker + manifest after MVP stable.
**Offline**: deferred. App has too much network-dependent state to bother early.

---

## 8. Persistence (TBD with notes)

Choices to lock in during implementation:

- **localStorage** for:
  - Theme + variant
  - Pomodoro durations
  - Todo list (under ~5MB ceiling, fine for years of tasks)
  - Tokens (Spotify, Google)
  - User settings flags
- **IndexedDB** for:
  - Session log history (potentially large)
  - Sticky notes if many or large
  - Cached calendar events (offline reads)
- **Export/import JSON**: planned for backup. Single button, downloads/uploads
  full state minus tokens.
- **Sync (cross-device)**: not in MVP. Candidate path = Gist-based: user pastes a
  GitHub PAT, site reads/writes a private gist. Last-write-wins.

Schema versioning: every persisted blob carries `version: N`. Migration functions
keyed by version delta.

---

## 9. Phasing

### MVP — ship first
1. Skeleton: Vite + TS scaffold, layout, sidebar, theme system bones.
2. **Minimal theme** day + night only.
3. **Pomodoro timer** (full feature set incl. tab title, sound, notification).
4. **Todo list** w/ Today/Tomorrow + drag reorder.
5. **Clock** + **Current Task Display**.
6. Theme switcher (only Minimal available).

Goal: I use it daily on my own laptop within ~1 week of focused build.

### Phase 2 — aesthetic + audio
7. Add 4 remaining themes (Cozy Dorm, Library, Central Park, Code Terminal).
8. Backdrop video/scene per theme.
9. Default music player (3 bundled tracks).
10. Volume + track picker UI.

### Phase 3 — integrations
11. Spotify connect + custom playback UI.
12. Spotify playlist browse / search / queue.
13. Google Calendar connect + today view.
14. Calendar event detail panel + week view toggle.

### Phase 4 — polish & extras
15. Hotkeys + cheatsheet.
16. Session log widget + stats.
17. Sticky notes (drag-position).
18. Weather, quote/intention, habit tracker (cherry-pick based on actual use).
19. Focus mode.
20. PWA install + Wake Lock.
21. Export/import JSON.

### Phase 5 — speculative
- Gist-based sync.
- Custom backdrop upload.
- Theme creator / sharing.

---

## 10. Open Questions / TBDs

- [ ] Framework: vanilla TS vs Solid vs other.
- [ ] Backdrop sourcing: hand-built CSS scenes vs licensed video per theme.
- [ ] Spotify default playlist exact URI.
- [ ] Sidebar tab structure (single panel vs Settings/Stats/Help tabs).
- [ ] Floating widget exact positions + whether resizable.
- [ ] Pomodoro sound assets (find or commission).
- [ ] Sync strategy if/when Phase 5 hits.
- [ ] Whether to register a separate Spotify dev app per friend or one shared
      (one shared, allowlisted — confirmed).

---

## 11. Risks & Mitigations

| Risk                                    | Mitigation                                  |
|-----------------------------------------|---------------------------------------------|
| Spotify token expiry mid-session        | Refresh proactively at 80% of TTL.          |
| Google quota burn from polling          | Poll calendar every 5min, not every render. |
| Backdrop video weight bloats repo       | Use `webm` w/ VP9, target <5MB per theme.   |
| Theme CSS scope leaks                   | CSS custom props on `<html>` data attribute. |
| Tab inactivity drains audio/video       | Pause on `visibilitychange`, resume on focus. |
| User loses tokens on cache clear        | Document in help; offer reconnect flow.     |
| Browser denies Notification permission  | Fall back to in-page toast.                 |
| Wake Lock unsupported (Firefox stable)  | Feature-detect, hide checkbox if absent.    |

---

## 12. Out of Scope (explicit)

- Mobile / responsive layouts.
- Account system, login, server-side state.
- Gmail integration.
- Real-time multi-user features (co-working rooms, presence).
- AI features (summaries, suggestions).
- Public launch / SEO / analytics.
- Internationalization.
- Accessibility audit beyond reasonable defaults (semantic HTML, keyboard nav,
  contrast). Formal WCAG compliance not pursued.

---

## 13. Working Agreement

- Track progress in a `todo.md` companion file (mirroring nonogram-solver pattern).
- Each phase = one rough sprint. Don't start phase N+1 until N is stable enough
  to use daily.
- Spec is living. Edit this file as decisions land. Don't let it rot.
