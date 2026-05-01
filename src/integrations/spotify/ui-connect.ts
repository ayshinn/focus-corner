// "Connect Spotify" drawer entry. Lives in the Integrations settings
// section. Spec §2 says everything stays in Developer Mode — we surface
// allowlist + Premium errors as inline messages rather than toasts so
// users understand why a connection didn't take.

import {
  connect,
  disconnect,
  getTokens,
  getMe,
  isSpotifyConfigured,
  patchTokens,
  subscribeTokens,
  SpotifyApiError,
} from './index';

interface MountOptions {
  target: HTMLElement;
}

function statusFor(): 'configured' | 'unconfigured' {
  return isSpotifyConfigured() ? 'configured' : 'unconfigured';
}

export function mountSpotifyConnect({ target }: MountOptions): void {
  target.classList.add('integration-row');
  target.innerHTML = `
    <div class="integration-row-head">
      <span class="integration-name">Spotify</span>
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
    const tokens = getTokens();
    if (statusFor() === 'unconfigured') {
      statusEl.textContent = 'not configured';
      metaEl.textContent = 'Set VITE_SPOTIFY_CLIENT_ID — see human-handoff.md.';
      btn.disabled = true;
      btn.textContent = 'Connect';
      return;
    }
    btn.disabled = false;
    if (tokens) {
      statusEl.textContent = 'connected';
      const profile = tokens.profile;
      metaEl.textContent = profile
        ? `${profile.displayName}${profile.product === 'premium' ? '' : ' (no Premium)'}`
        : '';
      btn.textContent = 'Disconnect';
    } else {
      statusEl.textContent = 'not connected';
      metaEl.textContent = '';
      btn.textContent = 'Connect';
    }
  }

  btn.addEventListener('click', () => {
    showError(null);
    if (getTokens()) {
      disconnect();
      return;
    }
    void connect().catch((err: unknown) => {
      showError(err instanceof Error ? err.message : 'Connect failed');
    });
  });

  subscribeTokens(() => {
    render();
    void hydrateProfileIfNeeded(showError);
  });
  render();
  void hydrateProfileIfNeeded(showError);
}

async function hydrateProfileIfNeeded(showError: (m: string | null) => void): Promise<void> {
  const tokens = getTokens();
  if (!tokens || tokens.profile) return;
  try {
    const me = await getMe();
    patchTokens({
      profile: {
        id: me.id,
        displayName: me.display_name ?? me.id,
        product: me.product,
      },
    });
    if (me.product !== 'premium') {
      showError('Spotify Premium required for in-app playback. Default music will play instead.');
    }
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      if (err.status === 403) {
        showError('Account not on the developer allowlist — ask Anthony to add you.');
      } else if (err.status === 401) {
        showError('Spotify session expired. Reconnect.');
      } else {
        showError(`Spotify error: ${err.message}`);
      }
    }
  }
}
