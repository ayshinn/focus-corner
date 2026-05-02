// Pure derivations over the session log. The widget renders these; the
// IndexedDB read happens in `index.ts`.

import type { SessionRecord } from '../pomodoro/session-log';

export interface DailyTotals {
  // YYYY-MM-DD local date keyed → minutes of focused work that day.
  byDay: Map<string, number>;
}

export interface WeeklySummary {
  totalFocusMinutesLast7Days: number;
  totalFocusMinutesLast30Days: number;
  totalSessionsCompleted: number;
  streakDays: number;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function deriveDailyTotals(sessions: SessionRecord[]): DailyTotals {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.startedAt));
    const minutes = Math.round(s.durationMs / 60_000);
    byDay.set(key, (byDay.get(key) ?? 0) + minutes);
  }
  return { byDay };
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function deriveWeekly(sessions: SessionRecord[], now: Date = new Date()): WeeklySummary {
  const today = startOfDay(now);
  const sevenAgo = addDays(today, -6);
  const thirtyAgo = addDays(today, -29);

  let totalLast7 = 0;
  let totalLast30 = 0;
  for (const s of sessions) {
    const minutes = Math.round(s.durationMs / 60_000);
    const started = new Date(s.startedAt);
    if (started >= sevenAgo) totalLast7 += minutes;
    if (started >= thirtyAgo) totalLast30 += minutes;
  }

  // Streak: walk backward from today; days without a session break it.
  const totals = deriveDailyTotals(sessions).byDay;
  let streak = 0;
  for (let i = 0; ; i += 1) {
    const key = dayKey(addDays(today, -i));
    if ((totals.get(key) ?? 0) > 0) streak += 1;
    else break;
  }

  return {
    totalFocusMinutesLast7Days: totalLast7,
    totalFocusMinutesLast30Days: totalLast30,
    totalSessionsCompleted: sessions.length,
    streakDays: streak,
  };
}

// Build a 7-row × N-column grid (rows = day-of-week starting Sunday,
// cols = weeks back from today's week). Returns most-recent-first.
export interface GridCell {
  date: Date;
  key: string;
  minutes: number;
  inFuture: boolean;
}

export function buildGrid(
  totals: DailyTotals,
  weeks: number,
  now: Date = new Date(),
): GridCell[][] {
  const today = startOfDay(now);
  const dow = today.getDay(); // 0 = Sun
  // Anchor to the Saturday at the end of current week so the latest column ends today/tomorrow.
  const anchorEnd = addDays(today, 6 - dow);
  const cells: GridCell[][] = [];
  for (let row = 0; row < 7; row += 1) {
    const rowCells: GridCell[] = [];
    for (let col = 0; col < weeks; col += 1) {
      const date = addDays(anchorEnd, -((weeks - 1 - col) * 7) - (6 - row));
      const key = dayKey(date);
      rowCells.push({
        date,
        key,
        minutes: totals.byDay.get(key) ?? 0,
        inFuture: date.getTime() > today.getTime(),
      });
    }
    cells.push(rowCells);
  }
  return cells;
}

export function toCsv(sessions: SessionRecord[]): string {
  const header = 'started_at_iso,ended_at_iso,duration_minutes,kind\n';
  const rows = sessions
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const start = new Date(s.startedAt).toISOString();
      const end = new Date(s.endedAt).toISOString();
      const minutes = (s.durationMs / 60_000).toFixed(2);
      return `${start},${end},${minutes},${s.kind}`;
    })
    .join('\n');
  return header + rows + (rows ? '\n' : '');
}
