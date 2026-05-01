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
import {
  addToQueue,
  clearQueue,
  getQueue,
  listMyPlaylists,
  playContext,
  search,
  type QueueSnapshot,
  type SearchResults,
  type SimplifiedPlaylist,
} from './discovery';
import { installSpotifyHotkeys } from './hotkeys';
import { SpotifyApiError } from './api';

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
          data-action="toggle-browse"
          aria-pressed="false"
          aria-label="Browse playlists / search / queue"
          title="Browse"
        >☰</button>
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
    <div class="music-browse" data-slot="browse" hidden>
      <div class="music-browse-tabs" role="tablist">
        <button type="button" class="music-tab" data-tab="search" aria-selected="true">Search</button>
        <button type="button" class="music-tab" data-tab="playlists" aria-selected="false">Playlists</button>
        <button type="button" class="music-tab" data-tab="queue" aria-selected="false">Queue</button>
      </div>
      <div class="music-browse-pane" data-pane="search">
        <input
          type="search"
          class="music-search-input"
          data-slot="search-input"
          placeholder="Search tracks / playlists…"
          aria-label="Spotify search"
        />
        <div class="music-search-results" data-slot="search-results"></div>
      </div>
      <div class="music-browse-pane" data-pane="playlists" hidden>
        <div class="music-playlists" data-slot="playlists"></div>
      </div>
      <div class="music-browse-pane" data-pane="queue" hidden>
        <div class="music-queue-actions">
          <button type="button" class="music-mini-btn" data-action="queue-refresh">Refresh</button>
          <button type="button" class="music-mini-btn" data-action="queue-clear">Clear</button>
        </div>
        <div class="music-queue" data-slot="queue"></div>
      </div>
    </div>
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
  const browseBtn = target.querySelector<HTMLButtonElement>('[data-action="toggle-browse"]')!;
  const browseEl = target.querySelector<HTMLElement>('[data-slot="browse"]')!;
  const errorEl = target.querySelector<HTMLElement>('[data-slot="error"]')!;
  const searchInput = target.querySelector<HTMLInputElement>('[data-slot="search-input"]')!;
  const searchResults = target.querySelector<HTMLElement>('[data-slot="search-results"]')!;
  const playlistsEl = target.querySelector<HTMLElement>('[data-slot="playlists"]')!;
  const queueEl = target.querySelector<HTMLElement>('[data-slot="queue"]')!;

  let scrubbing = false;
  let browseOpen = false;
  let activeTab: 'search' | 'playlists' | 'queue' = 'search';
  let playlistsLoaded = false;
  let searchToken = 0;

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
  browseBtn.addEventListener('click', () => {
    browseOpen = !browseOpen;
    browseEl.hidden = !browseOpen;
    browseBtn.setAttribute('aria-pressed', String(browseOpen));
    if (browseOpen) void loadActiveTab();
  });

  function setTab(tab: 'search' | 'playlists' | 'queue'): void {
    activeTab = tab;
    target.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
      el.setAttribute('aria-selected', String(el.dataset.tab === tab));
    });
    target.querySelectorAll<HTMLElement>('[data-pane]').forEach((el) => {
      el.hidden = el.dataset.pane !== tab;
    });
    void loadActiveTab();
  }

  async function loadActiveTab(): Promise<void> {
    if (activeTab === 'playlists' && !playlistsLoaded) await refreshPlaylists();
    if (activeTab === 'queue') await refreshQueue();
  }

  target.querySelector('.music-browse-tabs')?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    const tab = btn?.dataset.tab as 'search' | 'playlists' | 'queue' | undefined;
    if (tab) setTab(tab);
  });

  let searchTimer: number | null = null;
  searchInput.addEventListener('input', () => {
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    const term = searchInput.value;
    searchTimer = window.setTimeout(() => void runSearch(term), 250);
  });

  async function runSearch(term: string): Promise<void> {
    const myToken = ++searchToken;
    if (!term.trim()) {
      searchResults.innerHTML = '';
      return;
    }
    try {
      const results = await search(term);
      if (myToken !== searchToken) return;
      renderSearch(results);
    } catch (err) {
      if (myToken !== searchToken) return;
      searchResults.innerHTML = `<div class="music-empty">${escapeHtml(failureMessage(err))}</div>`;
    }
  }

  function renderSearch(results: SearchResults): void {
    if (results.tracks.length === 0 && results.playlists.length === 0) {
      searchResults.innerHTML = `<div class="music-empty">No matches.</div>`;
      return;
    }
    const trackHtml = results.tracks
      .map(
        (t) => `
        <li class="music-result" data-track-uri="${escapeHtml(t.uri)}">
          <div class="music-result-main">
            <span class="music-result-title">${escapeHtml(t.name)}</span>
            <span class="music-result-sub">${escapeHtml(t.artists)} — ${escapeHtml(t.album)}</span>
          </div>
          <button type="button" class="music-mini-btn" data-action="queue-track" data-uri="${escapeHtml(t.uri)}" aria-label="Queue ${escapeHtml(t.name)}">+ Queue</button>
        </li>`,
      )
      .join('');
    const playlistHtml = results.playlists
      .map(
        (p) => `
        <li class="music-result" data-playlist-uri="${escapeHtml(p.uri)}">
          <div class="music-result-main">
            <span class="music-result-title">${escapeHtml(p.name)}</span>
            <span class="music-result-sub">${escapeHtml(p.ownerName)} · ${p.trackCount} tracks</span>
          </div>
          <button type="button" class="music-mini-btn" data-action="play-playlist" data-uri="${escapeHtml(p.uri)}">Play</button>
        </li>`,
      )
      .join('');
    searchResults.innerHTML = `
      ${results.tracks.length ? `<div class="music-result-group"><h4>Tracks</h4><ul>${trackHtml}</ul></div>` : ''}
      ${results.playlists.length ? `<div class="music-result-group"><h4>Playlists</h4><ul>${playlistHtml}</ul></div>` : ''}
    `;
  }

  searchResults.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const uri = btn.dataset.uri;
    if (!uri) return;
    const action = btn.dataset.action;
    if (action === 'queue-track') {
      void addToQueue(uri).catch((err: unknown) => surfaceFailure(err));
    } else if (action === 'play-playlist') {
      void playContext(uri, getPlayback().deviceId ?? undefined).catch((err: unknown) =>
        surfaceFailure(err),
      );
    }
  });

  async function refreshPlaylists(): Promise<void> {
    playlistsEl.innerHTML = `<div class="music-empty">Loading…</div>`;
    try {
      const playlists = await listMyPlaylists();
      renderPlaylists(playlists);
      playlistsLoaded = true;
    } catch (err) {
      playlistsEl.innerHTML = `<div class="music-empty">${escapeHtml(failureMessage(err))}</div>`;
    }
  }

  function renderPlaylists(playlists: SimplifiedPlaylist[]): void {
    if (playlists.length === 0) {
      playlistsEl.innerHTML = `<div class="music-empty">No playlists found.</div>`;
      return;
    }
    playlistsEl.innerHTML = `
      <ul>
        ${playlists
          .map(
            (p) => `
          <li class="music-result">
            <div class="music-result-main">
              <span class="music-result-title">${escapeHtml(p.name)}</span>
              <span class="music-result-sub">${p.trackCount} tracks</span>
            </div>
            <button type="button" class="music-mini-btn" data-action="play-playlist" data-uri="${escapeHtml(p.uri)}">Play</button>
          </li>`,
          )
          .join('')}
      </ul>
    `;
  }

  playlistsEl.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action="play-playlist"]');
    const uri = btn?.dataset.uri;
    if (uri) {
      void playContext(uri, getPlayback().deviceId ?? undefined).catch((err: unknown) =>
        surfaceFailure(err),
      );
    }
  });

  async function refreshQueue(): Promise<void> {
    queueEl.innerHTML = `<div class="music-empty">Loading…</div>`;
    try {
      const snap = await getQueue();
      renderQueue(snap);
    } catch (err) {
      queueEl.innerHTML = `<div class="music-empty">${escapeHtml(failureMessage(err))}</div>`;
    }
  }

  function renderQueue(snap: QueueSnapshot): void {
    if (!snap.current && snap.upcoming.length === 0) {
      queueEl.innerHTML = `<div class="music-empty">Queue empty.</div>`;
      return;
    }
    const upcomingHtml = snap.upcoming
      .map(
        (q) => `
        <li class="music-queue-item">
          <span class="music-result-title">${escapeHtml(q.name)}</span>
          <span class="music-result-sub">${escapeHtml(q.artists)}</span>
        </li>`,
      )
      .join('');
    queueEl.innerHTML = `
      ${
        snap.current
          ? `<div class="music-queue-current">Now: <strong>${escapeHtml(snap.current.name)}</strong> — ${escapeHtml(snap.current.artists)}</div>`
          : ''
      }
      ${snap.upcoming.length ? `<ul class="music-queue-list">${upcomingHtml}</ul>` : '<div class="music-empty">No upcoming items.</div>'}
    `;
  }

  target.querySelector('[data-action="queue-refresh"]')?.addEventListener('click', () => {
    void refreshQueue();
  });
  target.querySelector('[data-action="queue-clear"]')?.addEventListener('click', () => {
    void clearQueue(getPlayback().deviceId ?? undefined)
      .then(() => refreshQueue())
      .catch((err: unknown) => surfaceFailure(err));
  });

  function failureMessage(err: unknown): string {
    if (err instanceof SpotifyApiError) {
      if (err.status === 403) return 'Forbidden — check allowlist / scopes.';
      if (err.status === 401) return 'Session expired — reconnect.';
      if (err.status === 404)
        return 'No active Spotify device. Use ⇄ to transfer playback here.';
      return err.message;
    }
    if (err instanceof Error) return err.message;
    return 'Spotify error';
  }

  function surfaceFailure(err: unknown): void {
    const message = failureMessage(err);
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

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
  const uninstallHotkeys = installSpotifyHotkeys();

  return {
    unmount(): void {
      unsubPlayback();
      unsubTokens();
      uninstallHotkeys();
      destroyPlayer();
      target.classList.remove('music-card-spotify');
      target.removeAttribute('data-mode');
    },
  };
}
