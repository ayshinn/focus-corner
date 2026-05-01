// Google Calendar API client. Just enough for the today / week views;
// uses raw `fetch` per spec §7 (no `gapi`). One call refreshes the
// token on 401 before re-trying.

import { GOOGLE_CALENDAR_API } from './config';
import { getValidGoogleToken, refreshGoogleNow } from './gis';

export class GoogleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GoogleApiError';
  }
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  htmlLink: string;
  raw: GoogleCalendarApiEvent;
}

interface GoogleCalendarApiEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

interface EventsListResponse {
  items?: GoogleCalendarApiEvent[];
}

interface ListEventsOptions {
  timeMin: Date;
  timeMax: Date;
  calendarId?: string;
}

function buildUrl(path: string, query: Record<string, string>): string {
  const url = new URL(`${GOOGLE_CALENDAR_API}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.toString();
}

async function doFetch<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let message = `Google ${res.status}`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      /* ignore */
    }
    throw new GoogleApiError(res.status, message);
  }
  return (await res.json()) as T;
}

async function googleFetch<T>(url: string): Promise<T> {
  const token = await getValidGoogleToken();
  if (!token) throw new GoogleApiError(401, 'Not connected to Google');
  try {
    return await doFetch<T>(token, url);
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 401) {
      const refreshed = await refreshGoogleNow().catch(() => null);
      if (refreshed?.accessToken) return doFetch<T>(refreshed.accessToken, url);
    }
    throw err;
  }
}

function parseEventTime(t?: { dateTime?: string; date?: string }): Date | null {
  if (!t) return null;
  if (t.dateTime) return new Date(t.dateTime);
  if (t.date) return new Date(`${t.date}T00:00:00`);
  return null;
}

function toEvent(raw: GoogleCalendarApiEvent): CalendarEvent {
  return {
    id: raw.id,
    summary: raw.summary ?? '(no title)',
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    ...(raw.location !== undefined ? { location: raw.location } : {}),
    start: parseEventTime(raw.start),
    end: parseEventTime(raw.end),
    allDay: Boolean(raw.start?.date && !raw.start?.dateTime),
    htmlLink: raw.htmlLink ?? '',
    raw,
  };
}

export async function listEvents(options: ListEventsOptions): Promise<CalendarEvent[]> {
  const calendarId = options.calendarId ?? 'primary';
  const url = buildUrl(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    timeMin: options.timeMin.toISOString(),
    timeMax: options.timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await googleFetch<EventsListResponse>(url);
  return (res.items ?? [])
    .filter((item) => item.status !== 'cancelled')
    .map(toEvent);
}

export function startOfDay(d: Date = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDay(d: Date = new Date()): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
