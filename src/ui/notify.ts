// Notification permission + dispatch with toast fallback. The first time
// a pomodoro work interval starts the user is prompted; if denied, every
// future interval-end shows an in-page toast instead.

import { showToast } from './toast';

let requested = false;

function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  if (requested) return Notification.permission;
  requested = true;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export interface NotifyOptions {
  body?: string;
}

export function notify(title: string, options: NotifyOptions = {}): void {
  const fallbackBody = options.body ? `${title} — ${options.body}` : title;
  if (!supported() || Notification.permission !== 'granted') {
    showToast(fallbackBody);
    return;
  }
  try {
    new Notification(title, { body: options.body ?? '' });
  } catch {
    showToast(fallbackBody);
  }
}
