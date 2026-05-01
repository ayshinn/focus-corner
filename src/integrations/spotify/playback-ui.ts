// Spotify playback floating card. Owns the same `data-slot="music"` slot
// as the default music UI — they swap based on whether Spotify is the
// active mode. Spec §5.4: "Custom UI — never the embed widget."
//
// Album art is hidden by default and only revealed by the toggle, so the
// card stays compact during deep work.

import {
  destroyPlayer,
  ensurePlayer,
  getPlayback,
  next,
  previous,
  seek,
  setShowAlbumArt,
  setVolume,
  subscribePlayback,
  togglePlay,
  transferToThisDevice,
  type PlaybackSnapshot,
} from './playback';
import { getTokens, subscribeTokens } from './store';

function fmt(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trackLine(snap: PlaybackSnapshot): string {
  const t = snap.track;
  if (!t) {
    if (snap.mode === 'connecting') return 'Connecting…';
    if (snap.mode === 'no-premium') return 'Premium required';
    if (snap.mode === 'ready') return 'Press play (or transfer here)';
    return '—';
  }
  const artists = t.artists.map((a) => a.name).join(', ');
  return `${escapeHtml(t.name)} — ${escapeHtml(artists)}`;
}

function albumArtUrl(snap: PlaybackSnapshot): string | null {
  const images = snap.track?.album?.images;
  if (!images || images.length === 0) return null;
  // Pick the smallest >=200px image, falling back to the first.
  const sorted = [...images].sort((a, b) => a.height - b.height);
  return (sorted.find((i) => i.height >= 200) ?? sorted[0])?.url ?? null;
}

interface UiHandles {
  unmount: () => void;
}

export function mountSpotifyPlayback(target: HTMLElement): UiHandles {
  target.classList.add('music-card', 'music-card-spotify');
  target.innerHTML = `
    <header class="music-header">
      <span class="music-title">Spotify</span>
      <div class="music-header-actions">
        <button
          type="button"
          class="music-icon-btn"
          data-action="toggle-art"
          aria-pressed="false"
          aria-label="Toggle album art"
          title="Album art"
        >▦</button>
        <button
          type="button"
          class="music-icon-btn"
          data-action="transfer"
          aria-label="Transfer playback here"
          title="Play here"
        >⇄</button>
      </div>
    </header>
    <div class="music-album-art" data-slot="art" hidden>
      <img alt="" data-slot="art-img" />
    </div>
    <div class="music-now" data-slot="now">—</div>
    <div class="music-scrub-row">
      <span class="music-time" data-slot="position">0:00</span>
      <input
        type="range"
        class="music-scrub"
        data-slot="scrub"
        min="0"
        max="1"
        value="0"
        step="1"
        aria-label="Seek"
      />
      <span class="music-time" data-slot="duration">0:00</span>
    </div>
    <div class="music-controls music-controls-spotify">
      <button type="button" class="music-btn" data-action="prev" aria-label="Previous">⏮</button>
      <button type="button" class="music-btn music-btn-primary" data-action="toggle" aria-label="Play / pause">▶</button>
      <button type="button" class="music-btn" data-action="next" aria-label="Next">⏭</button>
      <input
        type="range"
        class="music-volume"
        data-slot="volume"
        min="0"
        max="1"
        step="0.01"
        aria-label="Volume"
      />
    </div>
    <div class="music-error" data-slot="error" hidden></div>
  `;

  const artBox = target.querySelector<HTMLElement>('[data-slot="art"]')!;
  const artImg = target.querySelector<HTMLImageElement>('[data-slot="art-img"]')!;
  const nowEl = target.querySelector<HTMLElement>('[data-slot="now"]')!;
  const positionEl = target.querySelector<HTMLElement>('[data-slot="position"]')!;
  const durationEl = target.querySelector<HTMLElement>('[data-slot="duration"]')!;
  const scrubEl = target.querySelector<HTMLInputElement>('[data-slot="scrub"]')!;
  const volumeEl = target.querySelector<HTMLInputElement>('[data-slot="volume"]')!;
  const toggleBtn = target.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
  const prevBtn = target.querySelector<HTMLButtonElement>('[data-action="prev"]')!;
  const nextBtn = target.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  const transferBtn = target.querySelector<HTMLButtonElement>('[data-action="transfer"]')!;
  const artBtn = target.querySelector<HTMLButtonElement>('[data-action="toggle-art"]')!;
  const errorEl = target.querySelector<HTMLElement>('[data-slot="error"]')!;

  let scrubbing = false;

  function render(snap: PlaybackSnapshot): void {
    target.dataset.mode = snap.mode;
    nowEl.textContent = trackLine(snap);
    durationEl.textContent = fmt(snap.durationMs);
    positionEl.textContent = fmt(snap.positionMs);
    if (!scrubbing) {
      scrubEl.max = String(Math.max(1, snap.durationMs));
      scrubEl.value = String(snap.positionMs);
    }
    scrubEl.disabled = snap.durationMs === 0;
    if (Number(volumeEl.value) !== snap.volume) volumeEl.value = String(snap.volume);
    toggleBtn.textContent = snap.paused ? '▶' : '❚❚';
    toggleBtn.setAttribute('aria-pressed', String(!snap.paused));
    toggleBtn.disabled = snap.mode !== 'ready';
    prevBtn.disabled = snap.mode !== 'ready' || !snap.track;
    nextBtn.disabled = snap.mode !== 'ready' || !snap.track;
    transferBtn.disabled = !snap.deviceId;
    artBtn.setAttribute('aria-pressed', String(snap.showAlbumArt));
    const url = albumArtUrl(snap);
    if (snap.showAlbumArt && url) {
      artBox.hidden = false;
      if (artImg.src !== url) artImg.src = url;
    } else {
      artBox.hidden = true;
    }
    if (snap.errorMessage) {
      errorEl.hidden = false;
      errorEl.textContent = snap.errorMessage;
    } else {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  toggleBtn.addEventListener('click', () => void togglePlay());
  prevBtn.addEventListener('click', () => void previous());
  nextBtn.addEventListener('click', () => void next());
  transferBtn.addEventListener('click', () => void transferToThisDevice(true));
  artBtn.addEventListener('click', () => setShowAlbumArt(!getPlayback().showAlbumArt));

  scrubEl.addEventListener('pointerdown', () => {
    scrubbing = true;
  });
  scrubEl.addEventListener('change', () => {
    void seek(scrubEl.valueAsNumber);
    scrubbing = false;
  });
  scrubEl.addEventListener('pointercancel', () => {
    scrubbing = false;
  });
  volumeEl.addEventListener('input', () => {
    void setVolume(volumeEl.valueAsNumber);
  });

  const unsubPlayback = subscribePlayback(render);
  // Re-init the player if the user reconnects/disconnects mid-session.
  const unsubTokens = subscribeTokens((tokens) => {
    if (!tokens) destroyPlayer();
    else void ensurePlayer();
  });

  if (getTokens()) void ensurePlayer();
  render(getPlayback());

  return {
    unmount(): void {
      unsubPlayback();
      unsubTokens();
      destroyPlayer();
      target.classList.remove('music-card-spotify');
      target.removeAttribute('data-mode');
    },
  };
}
