// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { clear, read, write, type MigrationMap } from './versioned';

beforeEach(() => {
  localStorage.clear();
});

describe('versioned storage', () => {
  it('returns null when key missing', () => {
    expect(read('missing', 1)).toBeNull();
  });

  it('round-trips a value at the same version', () => {
    write('k', 1, { a: 1 });
    expect(read<{ a: number }>('k', 1)).toEqual({ a: 1 });
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('k', 'not json');
    expect(read('k', 1)).toBeNull();
  });

  it('returns null when stored shape is not an envelope', () => {
    localStorage.setItem('k', JSON.stringify({ unrelated: true }));
    expect(read('k', 1)).toBeNull();
  });

  it('returns null when stored version is newer than current', () => {
    write('k', 5, { a: 1 });
    expect(read('k', 1)).toBeNull();
  });

  it('applies migrations in order from stored version up to current', () => {
    write('k', 1, { a: 1 });
    const migrations: MigrationMap = {
      1: (prev) => ({ ...(prev as Record<string, number>), b: 2 }),
      2: (prev) => ({ ...(prev as Record<string, number>), c: 3 }),
    };
    const result = read<{ a: number; b: number; c: number }>('k', 3, migrations);
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('returns null when a required migration step is missing', () => {
    write('k', 1, { a: 1 });
    expect(read('k', 3, {})).toBeNull();
  });

  it('skips migration when stored version equals current', () => {
    write('k', 2, { a: 1 });
    const migrations: MigrationMap = {
      1: () => {
        throw new Error('should not run');
      },
    };
    expect(read('k', 2, migrations)).toEqual({ a: 1 });
  });

  it('clear removes the key', () => {
    write('k', 1, 'x');
    clear('k');
    expect(read('k', 1)).toBeNull();
  });
});
