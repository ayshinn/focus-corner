// Stats widget. Lives in the settings drawer (bottom of the body) so it
// doesn't compete with floating widgets for screen real estate. Reads
// the IDB session store (Step 17) and renders:
//   - 12-week activity grid
//   - last-7 / last-30 / total / streak summary
//   - one-button CSV export

import { listSessions, type SessionRecord } from '../pomodoro/session-log';
import { buildGrid, deriveDailyTotals, deriveWeekly, toCsv } from './derive';

const WEEKS_IN_GRID = 12;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function intensityClass(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 25) return 'l1';
  if (minutes < 60) return 'l2';
  if (minutes < 120) return 'l3';
  return 'l4';
}

function downloadCsv(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `focus-corner-sessions-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function mountStats(target: HTMLElement): void {
  target.classList.add('stats-section');
  target.innerHTML = `
    <div class="stats-summary" data-slot="summary"></div>
    <div class="stats-grid" data-slot="grid" aria-label="Focus minutes per day, last 12 weeks"></div>
    <div class="stats-actions">
      <button type="button" class="stats-export" data-action="export">Export CSV</button>
      <button type="button" class="stats-refresh" data-action="refresh">Refresh</button>
    </div>
  `;
  const summaryEl = target.querySelector<HTMLElement>('[data-slot="summary"]')!;
  const gridEl = target.querySelector<HTMLElement>('[data-slot="grid"]')!;

  let sessions: SessionRecord[] = [];

  function render(): void {
    const totals = deriveDailyTotals(sessions);
    const summary = deriveWeekly(sessions);
    summaryEl.innerHTML = `
      <div class="stats-stat"><span class="stats-num">${summary.streakDays}</span><span>day streak</span></div>
      <div class="stats-stat"><span class="stats-num">${summary.totalFocusMinutesLast7Days}m</span><span>last 7 days</span></div>
      <div class="stats-stat"><span class="stats-num">${summary.totalFocusMinutesLast30Days}m</span><span>last 30 days</span></div>
      <div class="stats-stat"><span class="stats-num">${summary.totalSessionsCompleted}</span><span>total sessions</span></div>
    `;

    const grid = buildGrid(totals, WEEKS_IN_GRID);
    gridEl.innerHTML = grid
      .map(
        (row) =>
          `<div class="stats-grid-row">${row
            .map((cell) => {
              const cls = cell.inFuture ? 'future' : intensityClass(cell.minutes);
              const title = cell.inFuture
                ? `${cell.key}: future`
                : `${cell.key}: ${cell.minutes}m`;
              return `<span class="stats-grid-cell ${cls}" title="${escapeHtml(title)}"></span>`;
            })
            .join('')}</div>`,
      )
      .join('');
  }

  async function refresh(): Promise<void> {
    sessions = await listSessions();
    render();
  }

  target.querySelector<HTMLButtonElement>('[data-action="export"]')?.addEventListener('click', () => {
    downloadCsv(toCsv(sessions));
  });
  target
    .querySelector<HTMLButtonElement>('[data-action="refresh"]')
    ?.addEventListener('click', () => void refresh());

  render();
  void refresh();
}
