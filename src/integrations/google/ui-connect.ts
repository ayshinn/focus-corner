// "Connect Google" Integrations row. Sits next to the Spotify row in
// the settings drawer. Surfaces test-user / quota errors inline.

import {
  connectGoogle,
  disconnectGoogle,
  getGoogleTokens,
  isGoogleConfigured,
  subscribeGoogleTokens,
} from './index';

interface MountOptions {
  target: HTMLElement;
}

export function mountGoogleConnect({ target }: MountOptions): void {
  target.classList.add('integration-row');
  target.innerHTML = `
    <div class="integration-row-head">
      <span class="integration-name">Google Calendar</span>
      <span class="integration-status" data-slot="status">—</span>
    </div>
    <div class="integration-meta" data-slot="meta"></div>
    <div class="integration-actions">
      <button type="button" class="integration-btn" data-action="toggle">Connect</button>
    </div>
    <div class="integration-error" data-slot="error" hidden></div>
  `;

  const statusEl = target.querySelector<HTMLElement>('[data-slot="status"]')!;
  const metaEl = target.querySelector<HTMLElement>('[data-slot="meta"]')!;
  const btn = target.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
  const errorEl = target.querySelector<HTMLElement>('[data-slot="error"]')!;

  function showError(message: string | null): void {
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function render(): void {
    const tokens = getGoogleTokens();
    if (!isGoogleConfigured()) {
      statusEl.textContent = 'not configured';
      metaEl.textContent = 'Set VITE_GOOGLE_CLIENT_ID — see human-handoff.md.';
      btn.disabled = true;
      btn.textContent = 'Connect';
      return;
    }
    btn.disabled = false;
    if (tokens) {
      statusEl.textContent = 'connected';
      metaEl.textContent = tokens.email ?? 'calendar.readonly';
      btn.textContent = 'Disconnect';
    } else {
      statusEl.textContent = 'not connected';
      metaEl.textContent = '';
      btn.textContent = 'Connect';
    }
  }

  btn.addEventListener('click', () => {
    showError(null);
    if (getGoogleTokens()) {
      disconnectGoogle();
      return;
    }
    void connectGoogle().catch((err: unknown) => {
      showError(err instanceof Error ? err.message : 'Connect failed');
    });
  });

  subscribeGoogleTokens(render);
  render();
}
