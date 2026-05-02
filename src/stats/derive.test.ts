import { describe, expect, it } from 'vitest';
import {
  buildGrid,
  dayKey,
  deriveDailyTotals,
  deriveWeekly,
  toCsv,
} from './derive';
import type { SessionRecord } from '../pomodoro/session-log';

function session(startIso: string, durationMin: number): SessionRecord {
  const startedAt = new Date(startIso).getTime();
  return {
    startedAt,
    endedAt: startedAt + durationMin * 60_000,
    durationMs: durationMin * 60_000,
    kind: 'work',
  };
}

describe('stats derivation', () => {
  it('groups sessions by local day', () => {
    const totals = deriveDailyTotals([
      session('2026-04-30T10:00:00', 25),
      session('2026-04-30T15:00:00', 25),
      session('2026-05-01T09:00:00', 50),
    ]);
    expect(totals.byDay.get('2026-04-30')).toBe(50);
    expect(totals.byDay.get('2026-05-01')).toBe(50);
  });

  it('computes streak as consecutive days back from today', () => {
    const today = new Date('2026-05-01T20:00:00');
    const summary = deriveWeekly(
      [
        session('2026-04-29T10:00:00', 25),
        session('2026-04-30T10:00:00', 25),
        session('2026-05-01T09:00:00', 25),
      ],
      today,
    );
    expect(summary.streakDays).toBe(3);
  });

  it('streak resets when a day has zero sessions', () => {
    const today = new Date('2026-05-01T20:00:00');
    const summary = deriveWeekly(
      [
        session('2026-04-29T10:00:00', 25), // skip 4-30
        session('2026-05-01T09:00:00', 25),
      ],
      today,
    );
    expect(summary.streakDays).toBe(1);
  });

  it('totals last-7 / last-30 / count', () => {
    const today = new Date('2026-05-01T20:00:00');
    const summary = deriveWeekly(
      [
        session('2026-05-01T08:00:00', 30), // today
        session('2026-04-28T08:00:00', 60), // last-7 in
        session('2026-04-10T08:00:00', 25), // last-30 in (21 days back)
        session('2026-03-15T08:00:00', 10), // outside
      ],
      today,
    );
    expect(summary.totalFocusMinutesLast7Days).toBe(90);
    expect(summary.totalFocusMinutesLast30Days).toBe(115);
    expect(summary.totalSessionsCompleted).toBe(4);
  });

  it('buildGrid yields 7 rows x N cols', () => {
    const totals = deriveDailyTotals([session('2026-05-01T10:00:00', 25)]);
    const grid = buildGrid(totals, 4, new Date('2026-05-01T20:00:00'));
    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(4);
  });

  it('grid cells flag future dates', () => {
    const grid = buildGrid({ byDay: new Map() }, 1, new Date('2026-05-01T20:00:00'));
    // Last column ends Saturday 2026-05-02. Friday (row 5) is today; Saturday (row 6) is future.
    expect(grid[6]?.[0]?.inFuture).toBe(true);
  });

  it('toCsv has a header and one row per session', () => {
    const csv = toCsv([
      session('2026-05-01T10:00:00', 25),
      session('2026-05-01T11:00:00', 25),
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('started_at_iso,ended_at_iso,duration_minutes,kind');
    expect(lines).toHaveLength(3);
  });

  it('dayKey is local date, not UTC', () => {
    // A late-evening UTC time still belongs to the local day in
    // negative-offset timezones; just sanity-check the format.
    expect(dayKey(new Date('2026-05-01T12:00:00'))).toBe('2026-05-01');
  });
});
