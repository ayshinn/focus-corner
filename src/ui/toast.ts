// Lightweight in-page toast. Used as a fallback when notifications are
// denied / unavailable, and for any quick transient feedback later.

const DEFAULT_TIMEOUT_MS = 4000;

let containerEl: HTMLElement | null = null;

function ensureContainer(): HTMLElement {
  if (containerEl && containerEl.isConnected) return containerEl;
  const el = document.createElement('div');
  el.className = 'toast-container';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  containerEl = el;
  return el;
}

export interface ToastOptions {
  timeoutMs?: number;
  variant?: 'info' | 'warn';
}

export function showToast(message: string, options: ToastOptions = {}): void {
  const container = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.dataset.variant = options.variant ?? 'info';
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger enter transition.
  requestAnimationFrame(() => toast.setAttribute('data-visible', 'true'));

  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  window.setTimeout(() => {
    toast.setAttribute('data-visible', 'false');
    window.setTimeout(() => toast.remove(), 200);
  }, timeout);
}
