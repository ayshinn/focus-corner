# todo

Progress tracker for focus-corner. Steps come from `implementation_steps.md`. Mark each step done as it lands; capture follow-ups inline.

## Phase 0 — Repo skeleton & deploy pipeline

- [ ] 1. Repo housekeeping (.gitignore, README, todo.md)
- [ ] 2. Vite + TypeScript scaffold
- [ ] 3. Strict TS config
- [ ] 4. Prettier config
- [ ] 5. ESLint config
- [ ] 6. Vite base path for Pages
- [ ] 7. GitHub Pages deploy workflow
- [ ] 8. Verify deploy
- [ ] 9. Vitest install + smoke test

## Phase 1 — Foundations (theme system, persistence, layout)

- [ ] 10. Schema-versioning helper
- [ ] 11. Settings store skeleton
- [ ] 12. Theme token contract
- [ ] 13. Theme registry + applier
- [ ] 14. Minimal theme tokens
- [ ] 15. Theme persistence
- [ ] 16. prefers-color-scheme listener
- [ ] 17. App shell HTML
- [ ] 18. CSS reset + base typography
- [ ] 19. Sidebar — theme picker stub
- [ ] 20. Sidebar — day/night toggle
- [ ] 21. Sidebar — settings gear stub
- [ ] 22. Minimal backdrop scene

## Phase 1 — Clock + Current Task scaffolding

- [ ] 23. Clock component
- [ ] 24. Clock 12/24h toggle
- [ ] 25. Current Task placeholder

## Phase 1 — Pomodoro

- [ ] 26. Pomodoro state machine
- [ ] 27. Pomodoro durations setting
- [ ] 28. Pomodoro UI shell
- [ ] 29. Tab title live update
- [ ] 30. Placeholder beep on interval end
- [ ] 31. Notification permission + fire
- [ ] 32. Wake Lock during work intervals
- [ ] 33. Session log writes (data only)

## Phase 1 — Todo list

- [ ] 34. Todo schema + reducer
- [ ] 35. Todo persistence
- [ ] 36. Todo column UI
- [ ] 37. Add via input + Enter
- [ ] 38. Mark done
- [ ] 39. Edit by click
- [ ] 40. Auto-clear after 24h
- [ ] 41. Midnight roll
- [ ] 42. Current Task wiring
- [ ] 43. Drag reorder within a column
- [ ] 44. Drag between columns

## Phase 1 — MVP polish & cut

- [ ] 45. Smoke pass + bug commit

## Phase 2 — Backdrops & themes

- [ ] 46. Backdrop video infrastructure
- [ ] 47. Asset budget guardrail
- [ ] 48. Cozy Dorm — tokens + day video
- [ ] 49. Cozy Dorm — night video
- [ ] 50. Library — tokens + day
- [ ] 51. Library — night
- [ ] 52. Central Park — tokens + day
- [ ] 53. Central Park — night
- [ ] 54. Code Terminal — tokens + day
- [ ] 55. Code Terminal — night
- [ ] 56. Theme-matched chimes

## Phase 2 — Default music

- [ ] 57. Audio engine
- [ ] 58. Bundle 3 default tracks
- [ ] 59. Music control UI
- [ ] 60. Theme default track wiring
- [ ] 61. Pause on tab hidden

## Phase 3 — Spotify

- [ ] 62. Spotify dev app docs
- [ ] 63. PKCE auth — start
- [ ] 64. Token storage + refresh
- [ ] 65. Web Playback SDK loader
- [ ] 66. Custom playback UI — basics
- [ ] 67. Transfer-to-this-device button
- [ ] 68. Album art toggle
- [ ] 69. Playlist picker
- [ ] 70. Search
- [ ] 71. Queue view
- [ ] 72. Music hotkeys
- [ ] 73. Spotify failure modes

## Phase 3 — Google Calendar

- [ ] 74. GIS auth — connect button
- [ ] 75. Calendar fetch — today
- [ ] 76. Calendar polling cadence
- [ ] 77. Next-event countdown in top bar
- [ ] 78. Week view toggle
- [ ] 79. Event detail panel
- [ ] 80. Calendar failure modes

## Phase 4 — Polish & extras

- [ ] 81. Global hotkey system
- [ ] 82. Session log widget
- [ ] 83. Stats display
- [ ] 84. CSV export for session log
- [ ] 85. Sticky notes — schema + render
- [ ] 86. Sticky notes — drag to position
- [ ] 87. Sticky notes — markdown-lite
- [ ] 88. Weather widget
- [ ] 89. Quote / intention widget
- [ ] 90. Habit tracker
- [ ] 91. Focus mode toggle
- [ ] 92. PWA manifest
- [ ] 93. Service worker
- [ ] 94. Export/import JSON
- [ ] 95. DOM / integration tests

## Phase 5 — Speculative

- [ ] 96. Gist-based sync
- [ ] 97. Custom backdrop upload
- [ ] 98. Theme creator / sharing

## Follow-ups

(Capture small items discovered mid-step that don't justify their own numbered step.)
