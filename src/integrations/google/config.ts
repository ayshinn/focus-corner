// Google Identity Services + Calendar API config. Public client ID only;
// no secret. Spec §2: stays in Test User mode (max 100), never published.

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Read-only is intentional. Spec §10 explicitly excludes write access
// and Gmail integration.
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

export function isGoogleConfigured(): boolean {
  return GOOGLE_CLIENT_ID.trim().length > 0;
}
