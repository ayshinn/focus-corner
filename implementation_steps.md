# focus-corner — Implementation Steps

> Each step = one commit. Steps build forward; nothing in a later step undoes earlier work. Logic-only Vitest in early steps; DOM/integration tests added later. Commit messages should reference the step number for traceability.

Locked decisions that shape this plan (from clarifying Q&A 2026-04-29):

- Framework: vanilla TS (no Solid unless reactivity proves painful — switch is its own future commit).
- Tooling: Prettier + ESLint from the start.
- Deploy: GitHub Pages from `main` via Actions, no `gh-pages` branch.
- MVP includes Wake Lock + Notification API + placeholder beep.
- Minimal theme uses CSS-only backdrop; video pipeline deferred to Phase 2.
- MVP sidebar = theme picker (Minimal only) + day/night toggle + settings gear stub.
- Floating widgets at fixed CSS positions in MVP; drag/resize deferred.
- `todo.md` companion file created in step 1.

> 2026-04-30 revision: phases 1-5 aggregated from 89 steps to 33. Smaller steps merged where they share a natural commit boundary; nothing dropped.

---

## Phase 0 — Repo skeleton & deploy pipeline

1. **Repo housekeeping.** Add `.gitignore` (node, build, OS junk), `README.md` stub (one-paragraph project blurb + link to spec), `todo.md` (mirrors §13 working agreement; seeded with phase headings only).
2. **Vite + TypeScript scaffold.** `index.html`, `src/main.ts`, `package.json`, `tsconfig.json`. Renders nothing but the title. No styling yet.
3. **Strict TS config.** Enable `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`. Fix any scaffold fallout.
4. **Prettier config.** `.prettierrc` + `.prettierignore`. Run `prettier --write .` once; commit the formatting churn alongside the config so future diffs stay clean.
5. **ESLint config.** Flat config, TS plugin, integrate Prettier (no style rules in lint). `npm run lint` script.
6. **Vite base path for Pages.** Set `base: '/focus-corner/'` in `vite.config.ts` so built asset URLs work at the deployed path.
7. **GitHub Pages deploy workflow.** `.github/workflows/deploy.yml`: build on push to `main`, upload `dist/` as Pages artifact, deploy. Enable Pages → "GitHub Actions" source manually after first run.
8. **Verify deploy.** Land a visible "focus-corner" heading on the homepage. After deploy succeeds, open `https://ayshinn.github.io/focus-corner/` and confirm. (Commit body documents the URL is live.)
9. **Vitest install + smoke test.** Add `vitest`, one trivial passing test (`expect(1).toBe(1)`), `npm test` script. Wires CI for later steps to extend.

## Phase 1 — MVP foundations + features

10. **Storage foundation.** `src/storage/versioned.ts` (`read<T>(key, version, migrations)` / `write(key, version, value)`, fully Vitest-tested) plus a settings store skeleton riding on it. Every later persistence step routes through this.
11. **Theme system.** Token contract (`src/theme/tokens.ts` listing CSS custom prop names), registry + `applyTheme(themeId, variant)` setting `data-theme` / `data-variant` on `<html>`, the Minimal theme registered with day/night tokens, persistence (`theme` + `themeVariant`, defaults Minimal + `auto`, hydrate before first paint to avoid FOUC), and a live `prefers-color-scheme` listener active when variant=`auto`.
12. **App shell + sidebar stubs.** Sidebar (left, narrow) + main-area grid, lightweight CSS reset + base typography (theme-token-driven), min-width 1280. Sidebar populated with: Minimal theme picker card (visual only), day/night/auto segmented toggle wired to persistence, settings gear icon that opens an empty drawer.
13. **Minimal backdrop scene.** Pure-CSS day + night scenes (gradient + subtle motion, e.g. slow conic-gradient drift) honoring theme tokens. Pause animation on `document.hidden`.
14. **Clock + Current Task placeholder.** Clock widget (large local time, date below, RAF-throttled-to-1s), 12/24h toggle in settings drawer (first real settings entry, persisted), top-bar Current Task slot rendering "No task" until step 19 wires it.
15. **Pomodoro core.** State machine (`idle | work | short_break | long_break`, cycle counter, long break every 4 cycles, durations as inputs, Vitest-covered), durations setting persisted via settings store, floating UI card (countdown + Start/Pause/Skip, manual advance only), live tab title `${mm}:${ss} — ${state}`.
16. **Pomodoro feedback.** Web Audio oscillator beep at interval end (`src/audio/beep.ts` so themed chimes can drop in later), Notification permission requested on first start with in-page toast fallback (`src/ui/toast.ts`), Wake Lock acquired during `work` intervals (feature-detected; hidden / no-op if `navigator.wakeLock` absent).
17. **Session log writes.** Append `{ startedAt, endedAt, duration, kind: 'work' }` to an IndexedDB store on each completed work interval. No UI yet — Phase 4 widget reads it.
18. **Todo logic + persistence.** Reducer (`add`, `edit`, `toggleDone`, `move`, `reorder`, `autoClear`, `rollMidnight`) with full Vitest coverage; wired to localStorage via versioned helper, schema version 1.
19. **Todo basic UI.** Two-column floating card (Today / Tomorrow) rendering items in order. Add via input + Enter (trim, ignore empty). Mark done (checkbox → strikethrough → sort bottom). Edit by clicking text (inline swap, Enter saves, Escape cancels). Top-bar Current Task slot now reads top of Today live.
20. **Todo time + drag.** Auto-clear done items older than configurable TTL on load + interval (setting in drawer). Midnight roll Tomorrow→Today via scheduled timeout that re-arms; runs once on load to catch missed rolls. Pointer Events drag-and-drop reorder within and between columns.
21. **MVP smoke pass.** Daily use for ~2 days; capture small fixes (focus rings, off-by-one tab title) in a follow-up commit before moving to Phase 2.

## Phase 2 — Themes + default music

22. **Backdrop video infrastructure.** `<video>` wired into theme system; theme registry gains optional `backdrop: { day, night, type: 'css' | 'video' }`. Page Visibility API pauses/resumes. Build-time guardrail script fails if any single backdrop > 10MB or total > 60MB. Minimal stays CSS.
23. **Cozy Dorm theme.** Tokens (warm beige, lamp lighting, plants day; dim lamp + string lights + fireplace night) + day and night videos (`webm` VP9, <5MB each).
24. **Library theme.** Tokens (sunlit window + wood + parchment day; candlelit shelves + fireplace night) + day and night videos.
25. **Central Park theme.** Tokens (daylight trees + path + joggers; lit lamps + fireflies + soft hum) + day and night videos.
26. **Code Terminal theme.** Tokens (light terminal + mono fonts + gridlines; black bg + neon CRT glow + scanlines) + day and night videos.
27. **Audio engine + default tracks + music UI.** `<audio>` + Web Audio gain node (fade + volume), 3 bundled royalty-free lofi tracks in `public/audio/` with JSON manifest, floating music control card (play/pause, picker, volume slider, loop indicator). Custom UI — no embed.
28. **Audio polish.** Per-theme default-track wiring (theme suggests track on first activation; user override sticks). Pause on `visibilitychange`, resume on focus only if previously playing. Replace placeholder beep with theme-matched chimes (terminal beep, library bell, etc.) — bundled assets selected by current theme.

## Phase 3 — Integrations

29. **Spotify auth.** `docs/spotify.md` covering dev-app config + redirect URI + allowlist instructions; README links to it. Connect button kicks off PKCE flow → callback handled in app root → token exchange. Tokens in localStorage (versioned), silent refresh at 80% TTL, disconnect button clears.
30. **Spotify playback core.** Web Playback SDK loaded post-connect, player named "focus-corner", device ID stored. Custom playback UI replaces default-music UI when Spotify connected & active: play/pause, prev/next, scrub bar, current track, volume, transfer-to-this-device button, hidden-by-default album art toggle.
31. **Spotify discovery + polish.** Playlist picker (lists user playlists, picking queues it), debounced track/artist/playlist search, queue view (read + clear). Hotkeys (space / `[` `]` / `-` `=`) registered with a small input-aware suppressor (full global system lands in step 34). Failure modes: non-Premium → "Premium required" + revert to default music; allowlist miss → "Ask Anthony to add you"; network error → graceful pill.
32. **Calendar auth + today view.** Sidebar "Connect Google" entry loads GIS, requests `calendar.readonly`. Token stored versioned. Fetch primary-calendar `events.list` for today on connect; render in floating card. Refetch every 5 min, paused when tab hidden. Top-bar gains "next event in Nm" countdown.
33. **Calendar polish.** Week-view toggle (`timeMax = startOfToday + 7d`, simple column layout — defer if implementation gets fiddly per spec §5.3). In-site event detail panel with "Open in Google Calendar" link; falls back to direct new-tab open if the panel proves janky. Failure pills: not-signed-in, "Calendar unavailable" on quota / network errors.

## Phase 4 — Polish & extras

34. **Global hotkey system + cheatsheet.** Centralized registry; suppressed in inputs. `?` opens cheatsheet modal. Existing music hotkeys migrate onto it.
35. **Session log widget + stats + export.** Reads IndexedDB store from step 17. Daily focus-minutes calendar-grid view, weekly streak / total focus hours / sessions completed derivations, single-button CSV export.
36. **Sticky notes.** IndexedDB schema, render at saved positions over backdrop, Pointer Events drag persists position, markdown-lite via `marked` with edit/preview toggle.
37. **Small widgets.** Weather (Open-Meteo keyless, geolocation prompt + manual-city fallback, 1h cache), quote/intention (local JSON pool OR daily user-typed intention, mode toggle in settings), habit tracker (daily checkboxes + last-30-days dot grid, IndexedDB persistence).
38. **Focus mode + PWA + export/import.** Focus-mode toggle (hides everything except pomodoro + clock; backdrop full-bleed; hotkey + sidebar control). PWA manifest (icons in 3 sizes, theme color from current theme) + service worker (precache shell + audio, runtime cache for backdrops, versioned cache name). Single-button JSON export (full state minus tokens) + import (schema version checked).
39. **DOM / integration tests.** Playwright (or Vitest browser mode) suite covering pomodoro full cycle, todo add/done/midnight-roll, theme switch, hotkeys. Graduates DOM testing from "later" to "now".

## Phase 5 — Speculative (only if/when daily use motivates them)

40. **Gist-based sync.** PAT input, last-write-wins read/write of full state to a private gist.
41. **Custom backdrop upload.** User-supplied video/image, IndexedDB-stored, theme registry extension.
42. **Theme creator / sharing.** Token-editing UI, export/import theme JSON.

---

## Working notes

- Spec §10 open questions get resolved inline as steps land. When one is answered, update `productivity_site_spec.md` in the same commit that consumes the answer.
- `todo.md` updates ride along with each commit (mark step done; capture follow-ups).
- Don't pull Phase N+1 work into Phase N. The phasing exists so the app stays usable end-to-end at each cut.
- If a step's scope balloons mid-implementation, split it rather than letting the commit grow. The numbering can grow (e.g. 15a / 15b) without renumbering the rest.
