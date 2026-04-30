# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Design phase. No code, no commits, no `package.json` yet. The full spec lives at `productivity_site_spec.md` (repo root) — read it before doing implementation work; it pins down decisions (theme list, feature scope, persistence model, phasing) that aren't yet reflected in code.

## Project

`focus-corner` — a personal aesthetic dashboard (pomodoro + todo + ambient backdrop + music + optional Spotify/Calendar). Hosted free on GitHub Pages at `https://ayshinn.github.io/focus-corner/`. Primary user is the author; secondary audience is ≤10 allowlisted friends. Not a public product.

## Hard constraints (from spec §2)

These shape every implementation decision; do not propose work that violates them without flagging the conflict:

- **Static site only.** No backend, no server-side env secrets, no DB. Hosted on GitHub Pages.
- **No CORS proxy.** Any third-party API must allow browser CORS or be keyless. Spotify/Google use browser-side OAuth (PKCE / GIS token model) — tokens live in `localStorage`, never on a server.
- **Spotify stays in Developer Mode** (max 25 allowlisted users); Google stays in **Test User mode** (max 100). No verification flow planned — do not propose changes that would require it.
- **Desktop-only.** Min viewport 1280×720. Mobile responsiveness is out of scope for MVP.
- **Backdrop asset budget**: <10MB per theme video, <60MB total. Prefer `webm` VP9.
- All persistent state is browser-local (`localStorage` for small/critical, `IndexedDB` for session log + sticky notes + cached calendar). Every persisted blob carries a `version: N` field; migrations are keyed by version delta.
- **Gmail integration is explicitly excluded.** Don't add it.

## Planned tech stack (spec §7 — overridable but defaulted)

- **Build**: Vite. **Language**: TypeScript strict + `noUncheckedIndexedAccess`.
- **Framework**: vanilla TS by default; Solid is the fallback if reactivity gets hairy. No React.
- **CSS**: hand-written with CSS custom properties for theme tokens, scoped via `data-theme` / `data-variant` attributes on `<html>`. No Tailwind.
- **Tests**: Vitest.
- **No heavy deps** — drag/drop via Pointer Events, icons via inline SVG sprite (Lucide), Google Calendar via raw `fetch` (skip `gapi`).

When the scaffold lands, expect commands roughly: `npm run dev` (Vite), `npm run build`, `npm test` / `npx vitest run <file>` for a single test. Verify against `package.json` once it exists rather than trusting these.

## Architecture intent (read before designing modules)

- **Single dashboard, no routing.** Sidebar (left, narrow) + full-bleed backdrop main area with floating cards (pomodoro, todo, music, calendar) over it.
- **Theme is the cross-cutting concern.** Picker drives backdrop scene + color tokens + fonts + accent + default ambient track. Day/night variant is a separate axis (`auto` follows `prefers-color-scheme`). Persisted as `theme` + `themeVariant` in localStorage. Default theme = Minimal so the page renders before user picks.
- **Pomodoro is decoupled from todos.** Timer is a clock, not task-bound. It writes to a session log fed into the (Tier 2) stats widget. Wake Lock engaged during work intervals; tab title shows live countdown.
- **Todo "current task"** = top item of the Today column. Other widgets (top bar) read it live. Tomorrow column auto-rolls to Today at local midnight.
- **Music has two modes**: bundled default tracks (3, royalty-free) OR Spotify Web Playback SDK when connected. Spotify takes precedence when active. Custom UI — never the embed widget.
- **Page Visibility API**: pause backdrop video and audio on `visibilitychange`; resume on focus. This is a recurring expectation, not per-feature.
- **Failure modes are first-class** for integrations: non-Premium Spotify → fall back to default music with a "Premium required" message; allowlist miss → "ask Anthony to add you"; Google not signed in / quota error → graceful pill, no crash. Notification permission denied → in-page toast.

## Phasing (spec §9)

Work is sprint-shaped: don't start phase N+1 until N is stable enough to use daily. MVP is intentionally narrow — Minimal theme only, pomodoro + todo + clock + current-task display + theme-switcher skeleton. Themes 2–5, music, Spotify, Calendar, stats, sticky notes, etc. all come later. When asked to "add X," check which phase it sits in before pulling forward work that the spec wants deferred.

## Working agreement (spec §13)

- Progress tracked in a `todo.md` companion file (mirrors the author's nonogram-solver repo pattern). Keep it current.
- The spec is living: when an open question (`§10`) gets resolved or a TBD gets locked in, update `productivity_site_spec.md` rather than letting decisions drift into code-only knowledge.
