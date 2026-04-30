// User-settings blob persisted via the versioned storage helper. The shape
// stays small on purpose; later steps add fields and bump VERSION +
// MIGRATIONS.

import { read, write, type MigrationMap } from './versioned';

export type ClockFormat = '12h' | '24h';

export interface Settings {
  clockFormat: ClockFormat;
}

const KEY = 'settings';
const VERSION = 1;
const MIGRATIONS: MigrationMap = {};

const DEFAULTS: Settings = {
  clockFormat: '12h',
};

const listeners = new Set<(settings: Settings) => void>();

export function getSettings(): Settings {
  const stored = read<Partial<Settings>>(KEY, VERSION, MIGRATIONS) ?? {};
  return { ...DEFAULTS, ...stored };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next: Settings = { ...getSettings(), ...patch };
  write(KEY, VERSION, next);
  for (const fn of listeners) fn(next);
  return next;
}

export function resetSettings(): Settings {
  write(KEY, VERSION, { ...DEFAULTS });
  for (const fn of listeners) fn({ ...DEFAULTS });
  return { ...DEFAULTS };
}

export function subscribeSettings(fn: (settings: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
