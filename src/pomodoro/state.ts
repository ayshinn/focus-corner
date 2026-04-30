// Pomodoro finite-state machine. Pure logic — no DOM, no timers — so the
// whole thing can be exercised with Vitest. The mounted UI in `index.ts`
// drives `tick(delta)` from real time and renders state.
//
// Cycle counter only increments on a *naturally* completed work interval
// (tick reaches zero). Skip/pause never count toward the cycle. Long break
// fires after every 4 completed work cycles.
//
// Manual advance: when an interval ends naturally, the state sits at
// remainingMs=0 / running=false. The user has to call `start()` (advance +
// run) or `skip()` (advance without running) to proceed.

export type Phase = 'idle' | 'work' | 'short_break' | 'long_break';

export interface Durations {
  workMs: number;
  shortBreakMs: number;
  longBreakMs: number;
}

export interface PomodoroState {
  phase: Phase;
  remainingMs: number;
  running: boolean;
  completedWorkCycles: number;
}

export interface PomodoroEvents {
  onChange?: (state: PomodoroState) => void;
  onIntervalEnd?: (phase: Exclude<Phase, 'idle'>) => void;
}

export interface PomodoroStore {
  getState(): PomodoroState;
  start(): void;
  pause(): void;
  skip(): void;
  reset(): void;
  tick(deltaMs: number): void;
  setDurations(durations: Durations): void;
  subscribe(fn: (state: PomodoroState) => void): () => void;
}

const LONG_BREAK_EVERY = 4;

function durationFor(phase: Phase, durations: Durations): number {
  switch (phase) {
    case 'work':
      return durations.workMs;
    case 'short_break':
      return durations.shortBreakMs;
    case 'long_break':
      return durations.longBreakMs;
    case 'idle':
      return 0;
  }
}

function nextPhase(state: PomodoroState): Exclude<Phase, 'idle'> {
  if (state.phase !== 'work') return 'work';
  const dueLong =
    state.completedWorkCycles > 0 && state.completedWorkCycles % LONG_BREAK_EVERY === 0;
  return dueLong ? 'long_break' : 'short_break';
}

export function createPomodoro(
  initialDurations: Durations,
  events: PomodoroEvents = {},
): PomodoroStore {
  let durations = { ...initialDurations };
  let state: PomodoroState = {
    phase: 'idle',
    remainingMs: 0,
    running: false,
    completedWorkCycles: 0,
  };
  const listeners = new Set<(state: PomodoroState) => void>();

  function emit(): void {
    const snapshot = { ...state };
    events.onChange?.(snapshot);
    for (const fn of listeners) fn(snapshot);
  }

  function advance(run: boolean): void {
    const phase = nextPhase(state);
    state = {
      ...state,
      phase,
      remainingMs: durationFor(phase, durations),
      running: run,
    };
  }

  return {
    getState: () => ({ ...state }),

    start(): void {
      if (state.phase === 'idle') {
        advance(true);
      } else if (state.remainingMs <= 0) {
        advance(true);
      } else {
        state = { ...state, running: true };
      }
      emit();
    },

    pause(): void {
      if (!state.running) return;
      state = { ...state, running: false };
      emit();
    },

    skip(): void {
      advance(false);
      emit();
    },

    reset(): void {
      state = {
        phase: 'idle',
        remainingMs: 0,
        running: false,
        completedWorkCycles: 0,
      };
      emit();
    },

    tick(deltaMs: number): void {
      if (!state.running) return;
      if (state.phase === 'idle') return;
      if (deltaMs <= 0) return;

      const next = state.remainingMs - deltaMs;
      if (next > 0) {
        state = { ...state, remainingMs: next };
        emit();
        return;
      }

      const endedPhase = state.phase;
      state = {
        ...state,
        remainingMs: 0,
        running: false,
        completedWorkCycles:
          endedPhase === 'work' ? state.completedWorkCycles + 1 : state.completedWorkCycles,
      };
      emit();
      events.onIntervalEnd?.(endedPhase);
    },

    setDurations(next: Durations): void {
      durations = { ...next };
    },

    subscribe(fn: (s: PomodoroState) => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case 'idle':
      return 'Idle';
    case 'work':
      return 'Work';
    case 'short_break':
      return 'Short Break';
    case 'long_break':
      return 'Long Break';
  }
}
