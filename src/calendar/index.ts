// Calendar floating card + topbar "next event in N" countdown. Reads
// from the Google integration; if the user isn't connected, the card
// renders a "connect to view" pill instead of nothing so the slot is
// discoverable.

import {
  addDays,
  endOfDay,
  GoogleApiError,
  listEvents,
  startOfDay,
  subscribeGoogleTokens,
  getGoogleTokens,
  type CalendarEvent,
} from '../integrations/google';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface CalendarHandles {
  refresh: () => Promise<void>;
}

interface State {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

let state: State = { events: [], loading: false, error: null };
const stateListeners = new Set<(s: State) => void>();

function setState(patch: Partial<State>): void {
  state = { ...state, ...patch };
  for (const fn of stateListeners) fn(state);
}

function failureMessage(err: unknown): string {
  if (err instanceof GoogleApiError) {
    if (err.status === 401) return 'Sign in to Google to load Calendar.';
    if (err.status === 403) return 'Calendar access forbidden — check test-user list.';
    if (err.status === 429) return 'Calendar quota — try again in a minute.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Calendar unavailable.';
}

async function refreshToday(): Promise<void> {
  if (!getGoogleTokens()) {
    setState({ events: [], error: null, loading: false });
    return;
  }
  setState({ loading: true, error: null });
  try {
    const events = await listEvents({
      timeMin: startOfDay(),
      timeMax: endOfDay(),
    });
    setState({ events, loading: false, error: null });
  } catch (err) {
    setState({ loading: false, error: failureMessage(err) });
  }
}

function fmtTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const display = ((h + 11) % 12) + 1;
  return `${display}:${m} ${ampm}`;
}

function timeUntil(d: Date): string {
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

function nextUpcoming(events: CalendarEvent[]): CalendarEvent | null {
  const now = Date.now();
  const future = events
    .filter((e) => !e.allDay && e.start && e.start.getTime() > now)
    .sort((a, b) => a.start!.getTime() - b.start!.getTime());
  return future[0] ?? null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mountCalendarCard(target: HTMLElement): CalendarHandles {
  target.classList.add('calendar-card');
  target.innerHTML = `
    <header class="calendar-header">
      <h3>Today</h3>
      <button type="button" class="calendar-refresh" data-action="refresh" aria-label="Refresh">↻</button>
    </header>
    <div class="calendar-body" data-slot="body"></div>
  `;
  const body = target.querySelector<HTMLElement>('[data-slot="body"]')!;
  target
    .querySelector<HTMLButtonElement>('[data-action="refresh"]')
    ?.addEventListener('click', () => void refreshToday());

  function render(): void {
    if (!getGoogleTokens()) {
      body.innerHTML = `<div class="calendar-pill">Connect Google in settings to see events.</div>`;
      return;
    }
    if (state.error) {
      body.innerHTML = `<div class="calendar-pill calendar-pill-warn">${escapeHtml(state.error)}</div>`;
      return;
    }
    if (state.loading && state.events.length === 0) {
      body.innerHTML = `<div class="calendar-pill">Loading…</div>`;
      return;
    }
    if (state.events.length === 0) {
      body.innerHTML = `<div class="calendar-pill">Nothing on your calendar today.</div>`;
      return;
    }
    body.innerHTML = `
      <ul class="calendar-list">
        ${state.events
          .map((e) => {
            const time = e.allDay
              ? 'all day'
              : e.start
                ? fmtTime(e.start)
                : '';
            return `<li class="calendar-event" data-event-id="${escapeHtml(e.id)}">
              <span class="calendar-event-time">${escapeHtml(time)}</span>
              <span class="calendar-event-title">${escapeHtml(e.summary)}</span>
            </li>`;
          })
          .join('')}
      </ul>
    `;
  }

  stateListeners.add(render);
  subscribeGoogleTokens((tokens) => {
    if (!tokens) {
      setState({ events: [], error: null });
    } else {
      void refreshToday();
    }
  });
  render();
  if (getGoogleTokens()) void refreshToday();

  // Periodic refetch — paused while tab hidden.
  let interval: number | null = null;
  function startInterval(): void {
    if (interval !== null) return;
    interval = window.setInterval(() => {
      if (!document.hidden) void refreshToday();
    }, REFRESH_INTERVAL_MS);
  }
  function stopInterval(): void {
    if (interval !== null) window.clearInterval(interval);
    interval = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopInterval();
    else {
      startInterval();
      if (getGoogleTokens()) void refreshToday();
    }
  });
  startInterval();

  return {
    refresh: refreshToday,
  };
}

export function mountNextEventPill(target: HTMLElement): void {
  target.classList.add('topbar-next-event');

  function render(): void {
    if (!getGoogleTokens()) {
      target.hidden = true;
      target.textContent = '';
      return;
    }
    const next = nextUpcoming(state.events);
    if (!next || !next.start) {
      target.hidden = false;
      target.textContent = 'No upcoming events';
      target.dataset.empty = 'true';
      return;
    }
    target.hidden = false;
    target.dataset.empty = 'false';
    target.textContent = `${next.summary} ${timeUntil(next.start)}`;
  }

  stateListeners.add(render);
  subscribeGoogleTokens(render);
  render();
  // Tick every 30s so the countdown stays current between refetches.
  window.setInterval(render, 30_000);
}

// Convenience: also let the calendar polish step (33) reach the events
// without re-fetching.
export function getEvents(): CalendarEvent[] {
  return state.events;
}

export async function refetchToday(): Promise<void> {
  await refreshToday();
}

export async function refetchRange(timeMin: Date, daysAhead: number): Promise<CalendarEvent[]> {
  if (!getGoogleTokens()) return [];
  return listEvents({ timeMin, timeMax: addDays(timeMin, daysAhead) });
}
