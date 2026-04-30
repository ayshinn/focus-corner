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

## Phase 1 — Foundations (theme system, persistence, layout)

10. **Schema-versioning helper.** `src/storage/versioned.ts`: `read<T>(key, version, migrations)` / `write(key, version, value)`. Logic-only, fully tested. Every later persistence step routes through this.
11. **Settings store skeleton.** Minimal user-settings blob (clock format, etc.) using the versioned helper. Just plumbing; no settings yet.
12. **Theme token contract.** `src/theme/tokens.ts` defining CSS custom property names (`--bg`, `--fg`, `--accent`, `--font-display`, etc.). No themes implemented yet — just the contract.
13. **Theme registry + applier.** `src/theme/index.ts` exporting a `Theme` type and an `applyTheme(themeId, variant)` that sets `data-theme` + `data-variant` on `<html>`. No themes registered yet.
14. **Minimal theme tokens.** Register the Minimal theme: day variant (clean light, soft shadows, sans) and night variant (dark gray base, low-contrast accent). Pure tokens — no scene yet.
15. **Theme persistence.** localStorage keys `theme` + `themeVariant` (`'day' | 'night' | 'auto'`). Defaults: theme = Minimal, variant = `auto`. Hydrate on load before first paint to avoid FOUC.
16. **`prefers-color-scheme` listener.** When variant = `auto`, react to OS-level changes live. Test via mock matchMedia.
17. **App shell HTML.** Sidebar (left, narrow) + main area markup. Empty placeholders. CSS grid / flex layout. Min-width 1280 enforced (overflow allowed; explicit "desktop only" message below threshold deferred).
18. **CSS reset + base typography.** Lightweight reset, body font from theme tokens, line-height, default focus ring.
19. **Sidebar — theme picker stub.** Single card for Minimal (with Day/Night thumb). Clicking it is a no-op for now — selection is only visual.
20. **Sidebar — day/night toggle.** Three-state segmented control: Day / Night / Auto. Wired to theme persistence.
21. **Sidebar — settings gear stub.** Icon button that opens an empty modal/drawer. Placeholder for later wiring.
22. **Minimal backdrop scene.** Pure-CSS gradient + subtle motion (e.g. slow conic-gradient drift) for day; deeper variant for night. Honors theme tokens. Pause animation when `document.hidden`.

## Phase 1 — Clock + Current Task scaffolding

23. **Clock component.** Local time, large/glanceable, date below. Tick on `requestAnimationFrame`-throttled-to-1s.
24. **Clock 12/24h toggle.** Lives in settings drawer (first real settings entry). Persisted via settings store.
25. **Current Task placeholder.** Top-bar slot reserved for the current task; renders "No task" until the todo store is wired in step 36. Done now so layout stabilizes.

## Phase 1 — Pomodoro

26. **Pomodoro state machine.** Logic-only module: states (`idle | work | short_break | long_break`), cycle counter, transition rules (long break every 4 work cycles), durations as inputs. Vitest covers all transitions.
27. **Pomodoro durations setting.** Configurable defaults (25 / 5 / 15) persisted via settings store. Settings drawer gains a Pomodoro section.
28. **Pomodoro UI shell.** Floating card at fixed position. Renders state + countdown + Start / Pause / Skip buttons. Manual advance only (no auto-start of next interval, per spec).
29. **Tab title live update.** `${mm}:${ss} — ${stateLabel}` while running; restore default title when idle.
30. **Placeholder beep on interval end.** Web Audio oscillator (~880 Hz, 200 ms, fade out). One source of truth in `src/audio/beep.ts` so themed chimes can replace it later.
31. **Notification permission + fire.** Request on first start; on interval end, send `Notification` if granted, else show in-page toast. Toast component lives in `src/ui/toast.ts` for reuse.
32. **Wake Lock during work intervals.** Feature-detect `navigator.wakeLock`; acquire on entering `work`, release on leaving. Hide / no-op if unsupported.
33. **Session log writes (data only).** Append `{ startedAt, endedAt, duration, kind: 'work' }` to an IndexedDB store on each completed work interval. No UI yet — Phase 4 reads it.

## Phase 1 — Todo list

34. **Todo schema + reducer.** Logic-only: items (`id, text, column: 'today' | 'tomorrow', done, doneAt, order`). Reducer actions: add, edit, toggleDone, move, reorder, autoClear, rollMidnight. Vitest covers each.
35. **Todo persistence.** Wire reducer to localStorage via versioned helper. Schema version 1.
36. **Todo column UI.** Two-column floating card (Today / Tomorrow). Renders items in order. No interactivity yet beyond render.
37. **Add via input + Enter.** Input at top of each column. Trims whitespace; ignores empty.
38. **Mark done.** Checkbox toggles done state; done items strike through and sort to bottom of their column.
39. **Edit by click.** Click text → inline contenteditable / input swap. Enter saves, Escape cancels.
40. **Auto-clear after 24h.** On load + on interval, drop done items where `doneAt < now - configurableTtl`. Setting added to drawer.
41. **Midnight roll.** Tomorrow → Today at local midnight. Implemented as a scheduled timeout that re-arms; also runs once on load to catch missed rolls.
42. **Current Task wiring.** Top-bar slot now reads the top item of Today live (subscribe to store). Empty state stays subtle.
43. **Drag reorder within a column.** Pointer Events; visual placeholder; commits on pointerup. Logic-only reorder math tested in step 34 already.
44. **Drag between columns.** Same drag system spans both columns.

## Phase 1 — MVP polish & cut

45. **Smoke pass + bug commit.** Use it personally for ~2 days; capture the inevitable small fixes (focus rings, off-by-one tab title, etc.) in one or two follow-up commits before moving on. Spec §9 goal: "I use it daily on my own laptop within ~1 week."

## Phase 2 — Backdrops & themes

46. **Backdrop video infrastructure.** `<video>` element wired into theme system; theme registry gains an optional `backdrop: { day: url, night: url, type: 'css' | 'video' }`. Page Visibility API pauses/plays. Minimal stays CSS.
47. **Asset budget guardrail.** Add a build-time check (or simple script in `scripts/`) that fails if any single backdrop asset > 10MB or total > 60MB. Prevents future bloat.
48. **Cozy Dorm — tokens + day video.** Theme tokens (warm beige, lamp lighting) + day backdrop asset (`webm` VP9, <5MB). Picker card now offers it.
49. **Cozy Dorm — night video.** Adds night variant.
50. **Library — tokens + day.** Sunlit window, wood, parchment.
51. **Library — night.** Candlelit shelves, fireplace.
52. **Central Park — tokens + day.** Daylight trees, path.
53. **Central Park — night.** Lit lamps, fireflies.
54. **Code Terminal — tokens + day.** Light terminal, mono fonts, gridlines.
55. **Code Terminal — night.** Black bg, neon CRT glow, scanlines.
56. **Theme-matched chimes.** Replace placeholder beep with per-theme chime (terminal beep, library bell, etc.). Bundled audio files; chime selected by current theme.

## Phase 2 — Default music

57. **Audio engine.** `<audio>` element + Web Audio gain node for fade in/out and volume. Module owns play/pause/track-change.
58. **Bundle 3 default tracks.** Royalty-free lofi-style, in `public/audio/`. JSON manifest with title, attribution, file.
59. **Music control UI.** Floating card: play/pause, track picker dropdown, volume slider, loop indicator. Custom UI — no embedded widget.
60. **Theme default track wiring.** Each theme suggests a default track on first activation; user override sticks.
61. **Pause on tab hidden.** Audio pauses on `visibilitychange`; resumes on focus only if it was playing.

## Phase 3 — Spotify

62. **Spotify dev app docs.** `docs/spotify.md` with redirect-URI registration steps + allowlist instructions. Links from README.
63. **PKCE auth — start.** "Connect Spotify" button kicks off PKCE flow, redirects to Spotify, handles callback in app root, exchanges code for tokens.
64. **Token storage + refresh.** Tokens in localStorage (versioned). Silent refresh at 80% of TTL (per §11). Disconnect button clears them.
65. **Web Playback SDK loader.** Inject SDK script post-connect. Initialize player, name device "focus-corner", store device ID.
66. **Custom playback UI — basics.** Play/pause, prev/next, scrub bar, current track text, volume. Replaces default-music UI when Spotify connected & active.
67. **Transfer-to-this-device button.** Calls `PUT /me/player` to make this tab the active device.
68. **Album art toggle.** Small album art thumbnail with a hide/show toggle (default hidden, per spec preference for restraint).
69. **Playlist picker.** Lists user's playlists; picking one queues it.
70. **Search.** Track/artist/playlist search with debounced input.
71. **Queue view.** Read + clear queue.
72. **Music hotkeys.** Space / `[` / `]` / `-` / `=`. Modal-aware (suppressed when typing in inputs).
73. **Spotify failure modes.** Non-Premium → "Premium required" message + revert to default music. Allowlist miss → "Ask Anthony to add you" copy. Network errors handled gracefully.

## Phase 3 — Google Calendar

74. **GIS auth — connect button.** Sidebar gains "Connect Google" entry. Loads GIS script, requests `calendar.readonly`. Token stored versioned.
75. **Calendar fetch — today.** `events.list` for primary calendar, `timeMin = startOfToday`, `timeMax = endOfToday`. Render in a floating card.
76. **Calendar polling cadence.** Refetch every 5 min (per §11), pause when tab hidden.
77. **Next-event countdown in top bar.** When connected, top bar shows the next upcoming event + relative time.
78. **Week view toggle.** Adds a toggle to fetch `timeMax = startOfToday + 7d` and render a simple week column layout. Defer if implementation gets fiddly (per spec §5.3).
79. **Event detail panel.** In-site panel for event metadata + "Open in Google Calendar" link. Falls back to direct new-tab open if the panel proves janky.
80. **Calendar failure modes.** Not-signed-in pill, quota / network "Calendar unavailable" pill.

## Phase 4 — Polish & extras

81. **Global hotkey system.** Centralized registry; suppressed in inputs. `?` opens cheatsheet modal. Existing music hotkeys migrate onto it.
82. **Session log widget.** Reads IndexedDB store from step 33. Daily focus-minutes + calendar-grid view. Lives in a sidebar tab or settings drawer section.
83. **Stats display.** Weekly streak, total focus hours, sessions completed. Cheap derivations from session log.
84. **CSV export for session log.** Single button.
85. **Sticky notes — schema + render.** IndexedDB store; render notes at saved positions over backdrop.
86. **Sticky notes — drag to position.** Pointer Events drag; persists position.
87. **Sticky notes — markdown-lite.** `marked` for inline render; toggle between edit and preview.
88. **Weather widget.** Open-Meteo (keyless). Geolocation prompt with manual-city fallback. Cached for an hour.
89. **Quote / intention widget.** Local JSON quotes pool OR a daily user-typed intention. Toggle between modes in settings.
90. **Habit tracker.** Daily checkboxes + last-30-days dot grid. IndexedDB persistence.
91. **Focus mode toggle.** Hides everything except pomodoro + clock; backdrop full-bleed. Hotkey + sidebar control.
92. **PWA manifest.** Icons (3 sizes), `manifest.webmanifest`, theme color from current theme.
93. **Service worker.** Precache shell + audio assets; runtime cache for backdrops. Versioned cache name.
94. **Export/import JSON.** Single button: download full state minus tokens; upload restores. Schema version checked on import.
95. **DOM / integration tests.** Add a Playwright (or Vitest browser mode) suite covering: pomodoro full cycle, todo add/done/midnight-roll, theme switch, hotkeys. This is the step where DOM testing graduates from "later" to "now."

## Phase 5 — Speculative (only if/when daily use motivates them)

96. **Gist-based sync.** PAT input, last-write-wins read/write of full state to a private gist.
97. **Custom backdrop upload.** User-supplied video/image; stored in IndexedDB; theme registry extension.
98. **Theme creator / sharing.** UI for editing tokens; export theme JSON; import theme JSON.

---

## Working notes

- Spec §10 open questions get resolved inline as steps land. When one is answered, update `productivity_site_spec.md` in the same commit that consumes the answer.
- `todo.md` updates ride along with each commit (mark step done; capture follow-ups).
- Don't pull Phase N+1 work into Phase N. The phasing exists so the app stays usable end-to-end at each cut.
- If a step's scope balloons mid-implementation, split it rather than letting the commit grow. The numbering can grow (e.g. 43a / 43b) without renumbering the rest.
