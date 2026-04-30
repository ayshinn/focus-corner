// User-settings blob persisted via the versioned storage helper. The shape
// stays small on purpose; later steps add fields and bump VERSION +
// MIGRATIONS.

import { read, write, type MigrationMap } from './versioned';

export type ClockFormat = '12h' | '24h';

export interface PomodoroDurationsMin {
  work: number;
  shortBreak: number;
  longBreak: number;
}

export interface Settings {
  clockFormat: ClockFormat;
  pomodoroDurationsMin: PomodoroDurationsMin;
}

const KEY = 'settings';
const VERSION = 2;

const DEFAULT_POMODORO: PomodoroDurationsMin = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
};

const DEFAULTS: Settings = {
  clockFormat: '12h',
  pomodoroDurationsMin: { ...DEFAULT_POMODORO },
};

const MIGRATIONS: MigrationMap = {
  1: (prev) => ({
    ...(prev as Record<string, unknown>),
    pomodoroDurationsMin: { ...DEFAULT_POMODORO },
  }),
};

const listeners = new Set<(settings: Settings) => void>();

function normalize(stored: Partial<Settings>): Settings {
  return {
    ...DEFAULTS,
    ...stored,
    pomodoroDurationsMin: {
      ...DEFAULT_POMODORO,
      ...(stored.pomodoroDurationsMin ?? {}),
    },
  };
}

export function getSettings(): Settings {
  const stored = read<Partial<Settings>>(KEY, VERSION, MIGRATIONS) ?? {};
  return normalize(stored);
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next = normalize({ ...getSettings(), ...patch });
  write(KEY, VERSION, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function resetSettings(): Settings {
  const next = normalize({});
  write(KEY, VERSION, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function subscribeSettings(fn: (settings: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
