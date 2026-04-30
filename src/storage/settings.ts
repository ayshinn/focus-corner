// User-settings blob persisted via the versioned storage helper. The shape
// stays narrow on purpose; later steps add fields (clock format, pomodoro
// durations, autoclear TTL, etc.) and bump VERSION + MIGRATIONS as needed.

import { read, write, type MigrationMap } from './versioned';

export interface Settings {
  // Placeholder. First real entry lands in step 14 (clock format).
  clockFormat?: '12h' | '24h';
}

const KEY = 'settings';
const VERSION = 1;
const MIGRATIONS: MigrationMap = {};
const DEFAULTS: Settings = {};

export function getSettings(): Settings {
  return read<Settings>(KEY, VERSION, MIGRATIONS) ?? { ...DEFAULTS };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const next: Settings = { ...getSettings(), ...patch };
  write(KEY, VERSION, next);
  return next;
}

export function resetSettings(): void {
  write(KEY, VERSION, { ...DEFAULTS });
}
