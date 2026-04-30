// Pomodoro floating card. Drives the FSM with wall-clock deltas, renders
// the countdown, exposes Start/Pause/Skip, and keeps the tab title in
// sync with the live timer.

import { getSettings, subscribeSettings, type PomodoroDurationsMin } from '../storage/settings';
import { playIntervalEndChime } from '../audio/beep';
import { ensureNotificationPermission, notify } from '../ui/notify';
import { acquireWakeLock, releaseWakeLock } from './wake-lock';
import {
  createPomodoro,
  formatRemaining,
  phaseLabel,
  type Durations,
  type Phase,
  type PomodoroState,
  type PomodoroStore,
} from './state';

const BASE_TITLE = 'focus-corner';

function toDurations(d: PomodoroDurationsMin): Durations {
  return {
    workMs: d.work * 60 * 1000,
    shortBreakMs: d.shortBreak * 60 * 1000,
    longBreakMs: d.longBreak * 60 * 1000,
  };
}

function nextLabel(state: PomodoroState): string {
  if (state.phase === 'idle') return 'Start';
  if (state.remainingMs <= 0) return 'Start next';
  return state.running ? 'Pause' : 'Resume';
}

function updateTabTitle(state: PomodoroState): void {
  if (state.phase === 'idle') {
    document.title = BASE_TITLE;
    return;
  }
  document.title = `${formatRemaining(state.remainingMs)} — ${phaseLabel(state.phase)}`;
}

let store: PomodoroStore | null = null;

export function getPomodoroStore(): PomodoroStore | null {
  return store;
}

function intervalEndMessage(phase: Exclude<Phase, 'idle'>): string {
  switch (phase) {
    case 'work':
      return 'Work session complete. Time for a break.';
    case 'short_break':
      return 'Short break done. Back to work?';
    case 'long_break':
      return 'Long break done. Back to work?';
  }
}

export function mountPomodoro(target: HTMLElement): PomodoroStore {
  const initialDurations = toDurations(getSettings().pomodoroDurationsMin);
  const pomodoro = createPomodoro(initialDurations, {
    onIntervalEnd: (phase) => {
      playIntervalEndChime();
      notify(`${phaseLabel(phase)} complete`, { body: intervalEndMessage(phase) });
      void releaseWakeLock();
    },
  });
  store = pomodoro;

  target.classList.add('pomodoro-card');
  target.innerHTML = `
    <header class="pomodoro-header">
      <span class="pomodoro-phase" data-slot="phase">Idle</span>
      <span class="pomodoro-cycles" data-slot="cycles">0 cycles</span>
    </header>
    <div class="pomodoro-time" data-slot="time">25:00</div>
    <div class="pomodoro-controls">
      <button type="button" class="pomodoro-btn pomodoro-btn-primary" data-action="start">Start</button>
      <button type="button" class="pomodoro-btn" data-action="skip">Skip</button>
    </div>
  `;

  const phaseEl = target.querySelector<HTMLElement>('[data-slot="phase"]')!;
  const cyclesEl = target.querySelector<HTMLElement>('[data-slot="cycles"]')!;
  const timeEl = target.querySelector<HTMLElement>('[data-slot="time"]')!;
  const primaryBtn = target.querySelector<HTMLButtonElement>('[data-action="start"]')!;
  const skipBtn = target.querySelector<HTMLButtonElement>('[data-action="skip"]')!;

  function render(state: PomodoroState): void {
    phaseEl.textContent = phaseLabel(state.phase);
    cyclesEl.textContent =
      state.completedWorkCycles === 1 ? '1 cycle' : `${state.completedWorkCycles} cycles`;
    timeEl.textContent =
      state.phase === 'idle'
        ? formatRemaining(initialDurationFor('work'))
        : formatRemaining(state.remainingMs);
    primaryBtn.textContent = nextLabel(state);
    target.setAttribute('data-phase', state.phase);
    target.setAttribute('data-running', String(state.running));
    updateTabTitle(state);
  }

  function initialDurationFor(phase: Phase): number {
    const d = toDurations(getSettings().pomodoroDurationsMin);
    if (phase === 'work') return d.workMs;
    if (phase === 'short_break') return d.shortBreakMs;
    if (phase === 'long_break') return d.longBreakMs;
    return 0;
  }

  pomodoro.subscribe(render);
  render(pomodoro.getState());

  primaryBtn.addEventListener('click', () => {
    const before = pomodoro.getState();
    if (before.running) {
      pomodoro.pause();
    } else {
      void ensureNotificationPermission();
      pomodoro.start();
    }
    syncWakeLock();
  });
  skipBtn.addEventListener('click', () => {
    pomodoro.skip();
    syncWakeLock();
  });

  function syncWakeLock(): void {
    const st = pomodoro.getState();
    if (st.phase === 'work' && st.running) void acquireWakeLock();
    else void releaseWakeLock();
  }

  // Real-time ticker. RAF when visible, setInterval fallback when hidden so
  // the FSM keeps progressing in background tabs (browser throttles RAF).
  let rafId: number | null = null;
  let intervalId: number | null = null;
  let lastTs = 0;

  function rafTick(ts: number): void {
    const delta = lastTs === 0 ? 0 : ts - lastTs;
    lastTs = ts;
    pomodoro.tick(delta);
    rafId = window.requestAnimationFrame(rafTick);
  }

  function startRaf(): void {
    if (rafId !== null) return;
    lastTs = 0;
    rafId = window.requestAnimationFrame(rafTick);
  }

  function stopRaf(): void {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = 0;
  }

  function startInterval(): void {
    if (intervalId !== null) return;
    let prev = performance.now();
    intervalId = window.setInterval(() => {
      const now = performance.now();
      pomodoro.tick(now - prev);
      prev = now;
    }, 1000);
  }

  function stopInterval(): void {
    if (intervalId !== null) window.clearInterval(intervalId);
    intervalId = null;
  }

  function syncTickerToVisibility(): void {
    if (document.hidden) {
      stopRaf();
      startInterval();
    } else {
      stopInterval();
      startRaf();
    }
  }

  syncTickerToVisibility();
  document.addEventListener('visibilitychange', syncTickerToVisibility);

  // Settings changes update durations live (only affects future intervals).
  subscribeSettings((settings) => {
    pomodoro.setDurations(toDurations(settings.pomodoroDurationsMin));
    // Re-render so the idle countdown reflects the new work duration.
    render(pomodoro.getState());
  });

  return pomodoro;
}
