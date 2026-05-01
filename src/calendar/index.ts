// Calendar floating card + topbar "next event in N" countdown. Reads
// from the Google integration; if the user isn't connected, the card
// renders a "connect to view" pill instead of nothing so the slot is
// discoverable.
//
// Step 33 adds the polish layer on top of step 32:
//   - week-view toggle (timeMax = startOfToday + 7d, simple column list)
//   - in-card event detail panel with "Open in Google Calendar"
//   - graceful fallback: if the detail render throws or htmlLink is
//     missing, the click opens the GCal page directly in a new tab.

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

type View = 'today' | 'week';

interface CalendarHandles {
  refresh: () => Promise<void>;
}

interface State {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  view: View;
}

let state: State = { events: [], loading: false, error: null, view: 'today' };
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

async function refresh(view: View = state.view): Promise<void> {
  if (!getGoogleTokens()) {
    setState({ events: [], error: null, loading: false });
    return;
  }
  setState({ loading: true, error: null, view });
  try {
    const timeMin = startOfDay();
    const timeMax = view === 'today' ? endOfDay() : endOfDay(addDays(timeMin, 6));
    const events = await listEvents({ timeMin, timeMax });
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

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function groupByDay(events: CalendarEvent[]): Array<{ day: Date; items: CalendarEvent[] }> {
  const buckets = new Map<string, { day: Date; items: CalendarEvent[] }>();
  for (const e of events) {
    if (!e.start) continue;
    const day = startOfDay(e.start);
    const key = day.toISOString();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { day, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(e);
  }
  return Array.from(buckets.values()).sort((a, b) => a.day.getTime() - b.day.getTime());
}

export function mountCalendarCard(target: HTMLElement): CalendarHandles {
  target.classList.add('calendar-card');
  target.innerHTML = `
    <header class="calendar-header">
      <h3>Calendar</h3>
      <div class="calendar-toolbar">
        <div class="calendar-view-toggle" role="tablist">
          <button type="button" data-view="today" aria-pressed="true">Today</button>
          <button type="button" data-view="week" aria-pressed="false">Week</button>
        </div>
        <button type="button" class="calendar-refresh" data-action="refresh" aria-label="Refresh">↻</button>
      </div>
    </header>
    <div class="calendar-body" data-slot="body"></div>
    <div class="calendar-detail" data-slot="detail" hidden></div>
  `;
  const body = target.querySelector<HTMLElement>('[data-slot="body"]')!;
  const detail = target.querySelector<HTMLElement>('[data-slot="detail"]')!;

  let detailEventId: string | null = null;

  target
    .querySelector<HTMLButtonElement>('[data-action="refresh"]')
    ?.addEventListener('click', () => void refresh());

  target.querySelectorAll<HTMLElement>('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view as View;
      target.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.view === view));
      });
      void refresh(view);
    });
  });

  function eventListItem(e: CalendarEvent): string {
    const time = e.allDay ? 'all day' : e.start ? fmtTime(e.start) : '';
    return `<li class="calendar-event" data-event-id="${escapeHtml(e.id)}" tabindex="0">
      <span class="calendar-event-time">${escapeHtml(time)}</span>
      <span class="calendar-event-title">${escapeHtml(e.summary)}</span>
    </li>`;
  }

  function todayHtml(events: CalendarEvent[]): string {
    return `<ul class="calendar-list">${events.map(eventListItem).join('')}</ul>`;
  }

  function weekHtml(events: CalendarEvent[]): string {
    const groups = groupByDay(events);
    if (groups.length === 0) return `<div class="calendar-pill">Nothing this week.</div>`;
    return groups
      .map(
        (g) => `
      <div class="calendar-day-group">
        <h4>${escapeHtml(fmtDay(g.day))}</h4>
        <ul class="calendar-list">${g.items.map(eventListItem).join('')}</ul>
      </div>`,
      )
      .join('');
  }

  function renderList(): void {
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
      body.innerHTML =
        state.view === 'today'
          ? `<div class="calendar-pill">Nothing on your calendar today.</div>`
          : `<div class="calendar-pill">Nothing this week.</div>`;
      return;
    }
    body.innerHTML = state.view === 'today' ? todayHtml(state.events) : weekHtml(state.events);
  }

  function renderDetail(): void {
    if (!detailEventId) {
      detail.hidden = true;
      detail.innerHTML = '';
      body.hidden = false;
      return;
    }
    const event = state.events.find((e) => e.id === detailEventId);
    if (!event) {
      detailEventId = null;
      detail.hidden = true;
      body.hidden = false;
      return;
    }
    body.hidden = true;
    detail.hidden = false;
    const range = !event.allDay && event.start && event.end
      ? `${fmtTime(event.start)} – ${fmtTime(event.end)}`
      : event.allDay
        ? 'All day'
        : '';
    const link = event.htmlLink
      ? `<a class="calendar-detail-link" href="${escapeHtml(event.htmlLink)}" target="_blank" rel="noopener">Open in Google Calendar ↗</a>`
      : '';
    detail.innerHTML = `
      <button type="button" class="calendar-detail-back" data-action="detail-close">← Back</button>
      <h4>${escapeHtml(event.summary)}</h4>
      <div class="calendar-detail-meta">${escapeHtml(range)}</div>
      ${event.location ? `<div class="calendar-detail-meta">📍 ${escapeHtml(event.location)}</div>` : ''}
      ${event.description ? `<div class="calendar-detail-desc">${escapeHtml(event.description)}</div>` : ''}
      ${link}
    `;
    detail
      .querySelector<HTMLButtonElement>('[data-action="detail-close"]')
      ?.addEventListener('click', () => {
        detailEventId = null;
        renderDetail();
      });
  }

  function render(): void {
    try {
      renderList();
      renderDetail();
    } catch (err) {
      // If the detail render throws, fall back to opening the gcal page
      // directly so the user is never stuck.
      const fallback = state.events.find((e) => e.id === detailEventId);
      if (fallback?.htmlLink) {
        window.open(fallback.htmlLink, '_blank', 'noopener');
      }
      detailEventId = null;
      detail.hidden = true;
      body.hidden = false;
      const message = err instanceof Error ? err.message : 'Detail render failed';
      body.innerHTML = `<div class="calendar-pill calendar-pill-warn">${escapeHtml(message)}</div>`;
    }
  }

  body.addEventListener('click', (event) => {
    const li = (event.target as HTMLElement).closest<HTMLElement>('.calendar-event');
    if (!li) return;
    const id = li.dataset.eventId;
    if (!id) return;
    detailEventId = id;
    renderDetail();
  });

  // Keyboard activation for the focused event row.
  body.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const li = (event.target as HTMLElement).closest<HTMLElement>('.calendar-event');
    if (!li?.dataset.eventId) return;
    event.preventDefault();
    detailEventId = li.dataset.eventId;
    renderDetail();
  });

  stateListeners.add(render);
  subscribeGoogleTokens((tokens) => {
    if (!tokens) {
      detailEventId = null;
      setState({ events: [], error: null });
    } else {
      void refresh();
    }
  });
  render();
  if (getGoogleTokens()) void refresh();

  let interval: number | null = null;
  function startInterval(): void {
    if (interval !== null) return;
    interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
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
      if (getGoogleTokens()) void refresh();
    }
  });
  startInterval();

  return { refresh: () => refresh() };
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
  window.setInterval(render, 30_000);
}

export function getEvents(): CalendarEvent[] {
  return state.events;
}

export async function refetchToday(): Promise<void> {
  await refresh('today');
}

export async function refetchRange(timeMin: Date, daysAhead: number): Promise<CalendarEvent[]> {
  if (!getGoogleTokens()) return [];
  return listEvents({ timeMin, timeMax: addDays(timeMin, daysAhead) });
}
