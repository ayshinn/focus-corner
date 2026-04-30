# todo

Progress tracker for focus-corner. Steps come from `implementation_steps.md`. Mark each step done as it lands; capture follow-ups inline.

## Phase 0 — Repo skeleton & deploy pipeline

- [x] 1. Repo housekeeping (.gitignore, README, todo.md)
- [x] 2. Vite + TypeScript scaffold
- [x] 3. Strict TS config
- [x] 4. Prettier config
- [x] 5. ESLint config
- [x] 6. Vite base path for Pages
- [x] 7. GitHub Pages deploy workflow
- [x] 8. Verify deploy
- [x] 9. Vitest install + smoke test

## Phase 1 — MVP foundations + features

- [x] 10. Storage foundation (versioned helper + settings store)
- [x] 11. Theme system (tokens, registry, Minimal, persistence, prefers-color-scheme)
- [x] 12. App shell + sidebar stubs (theme picker, day/night toggle, settings gear)
- [x] 13. Minimal backdrop scene
- [x] 14. Clock + Current Task placeholder
- [x] 15. Pomodoro core (state machine, durations, UI shell, tab title)
- [ ] 16. Pomodoro feedback (beep, notification + toast, Wake Lock)
- [ ] 17. Session log writes (IndexedDB)
- [ ] 18. Todo logic + persistence
- [ ] 19. Todo basic UI (render, add, done, edit, current task wiring)
- [ ] 20. Todo time + drag (auto-clear, midnight roll, drag within + between)
- [ ] 21. MVP smoke pass + bug commit

## Phase 2 — Themes + default music

- [ ] 22. Backdrop video infrastructure + asset budget guardrail
- [ ] 23. Cozy Dorm theme (day + night)
- [ ] 24. Library theme (day + night)
- [ ] 25. Central Park theme (day + night)
- [ ] 26. Code Terminal theme (day + night)
- [ ] 27. Audio engine + default tracks + music UI
- [ ] 28. Audio polish (theme defaults, pause on hidden, theme-matched chimes)

## Phase 3 — Integrations

- [ ] 29. Spotify auth (PKCE, token storage + refresh, dev-app docs)
- [ ] 30. Spotify playback core (SDK, custom UI, transfer device, album art)
- [ ] 31. Spotify discovery + polish (playlist, search, queue, hotkeys, failure modes)
- [ ] 32. Calendar auth + today view + next-event countdown
- [ ] 33. Calendar polish (week view, event detail panel, failure pills)

## Phase 4 — Polish & extras

- [ ] 34. Global hotkey system + cheatsheet
- [ ] 35. Session log widget + stats + CSV export
- [ ] 36. Sticky notes (schema, render, drag, markdown-lite)
- [ ] 37. Small widgets (weather, quote/intention, habit tracker)
- [ ] 38. Focus mode + PWA + export/import JSON
- [ ] 39. DOM / integration tests

## Phase 5 — Speculative

- [ ] 40. Gist-based sync
- [ ] 41. Custom backdrop upload
- [ ] 42. Theme creator / sharing

## Follow-ups

(Capture small items discovered mid-step that don't justify their own numbered step.)
