// Music floating card. Wires the audio engine to a small UI: track
// picker, play/pause, loop toggle, volume slider. State (trackId,
// volume, loop) persists via the versioned helper so reloads restore
// the user's last choice — but autoplay is never resumed without an
// explicit click (browser policy).

import { read, write, type MigrationMap } from '../storage/versioned';
import { createAudioEngine, type AudioEngine, type MusicState } from './engine';
import { loadManifest, type Track } from './manifest';

interface PersistedMusic {
  trackId: string | null;
  volume: number;
  loop: boolean;
}

const STORAGE_KEY = 'music';
const STORAGE_VERSION = 1;
const STORAGE_MIGRATIONS: MigrationMap = {};

function loadPersisted(): Partial<PersistedMusic> {
  const stored = read<unknown>(STORAGE_KEY, STORAGE_VERSION, STORAGE_MIGRATIONS);
  if (!stored || typeof stored !== 'object') return {};
  const v = stored as Record<string, unknown>;
  const out: Partial<PersistedMusic> = {};
  if (typeof v.trackId === 'string' || v.trackId === null) out.trackId = v.trackId as string | null;
  if (typeof v.volume === 'number') out.volume = v.volume;
  if (typeof v.loop === 'boolean') out.loop = v.loop;
  return out;
}

function savePersisted(state: MusicState): void {
  const persisted: PersistedMusic = {
    trackId: state.trackId,
    volume: state.volume,
    loop: state.loop,
  };
  write(STORAGE_KEY, STORAGE_VERSION, persisted);
}

export function mountMusic(target: HTMLElement): AudioEngine {
  const persisted = loadPersisted();
  const engine = createAudioEngine({
    ...(persisted.volume !== undefined ? { volume: persisted.volume } : {}),
    ...(persisted.loop !== undefined ? { loop: persisted.loop } : {}),
  });

  target.classList.add('music-card');
  target.innerHTML = `
    <header class="music-header">
      <span class="music-title">Music</span>
      <button
        type="button"
        class="music-loop"
        data-action="loop"
        aria-pressed="false"
        aria-label="Toggle loop"
        title="Loop"
      >↻</button>
    </header>
    <select class="music-picker" data-slot="picker" aria-label="Track" disabled>
      <option value="">No tracks</option>
    </select>
    <div class="music-now" data-slot="now">—</div>
    <div class="music-controls">
      <button
        type="button"
        class="music-btn music-btn-primary"
        data-action="play"
        aria-label="Play / pause"
        disabled
      >▶</button>
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
  `;

  const picker = target.querySelector<HTMLSelectElement>('[data-slot="picker"]')!;
  const playBtn = target.querySelector<HTMLButtonElement>('[data-action="play"]')!;
  const loopBtn = target.querySelector<HTMLButtonElement>('[data-action="loop"]')!;
  const volume = target.querySelector<HTMLInputElement>('[data-slot="volume"]')!;
  const nowEl = target.querySelector<HTMLElement>('[data-slot="now"]')!;

  function renderTracks(tracks: Track[]): void {
    if (tracks.length === 0) {
      picker.innerHTML = `<option value="">No tracks — add to public/audio/manifest.json</option>`;
      picker.disabled = true;
      playBtn.disabled = true;
      nowEl.textContent = 'Drop bundled tracks in public/audio/.';
      return;
    }
    picker.disabled = false;
    playBtn.disabled = false;
    const options = ['<option value="">Choose track…</option>']
      .concat(tracks.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`))
      .join('');
    picker.innerHTML = options;
  }

  function render(state: MusicState): void {
    const track = engine.getTracks().find((t) => t.id === state.trackId) ?? null;
    if (picker.value !== (state.trackId ?? '')) {
      picker.value = state.trackId ?? '';
    }
    nowEl.textContent = track ? track.label : engine.getTracks().length ? 'Pick a track' : nowEl.textContent;
    playBtn.textContent = state.playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-pressed', String(state.playing));
    playBtn.disabled = engine.getTracks().length === 0 || !state.trackId;
    loopBtn.setAttribute('aria-pressed', String(state.loop));
    if (Number(volume.value) !== state.volume) {
      volume.value = String(state.volume);
    }
  }

  picker.addEventListener('change', () => {
    const id = picker.value;
    if (!id) return;
    if (engine.load(id)) {
      // User explicitly picked — start playing.
      void engine.play();
    }
  });

  playBtn.addEventListener('click', () => {
    void engine.toggle();
  });

  loopBtn.addEventListener('click', () => {
    engine.setLoop(!engine.getState().loop);
  });

  volume.addEventListener('input', () => {
    engine.setVolume(volume.valueAsNumber);
  });

  engine.subscribe((state) => {
    render(state);
    savePersisted(state);
  });

  // Initial render before the manifest resolves so the user sees the
  // shell rather than an empty card.
  renderTracks([]);
  render(engine.getState());

  void loadManifest().then((tracks) => {
    engine.setTracks(tracks);
    renderTracks(tracks);
    if (persisted.trackId && tracks.some((t) => t.id === persisted.trackId)) {
      engine.load(persisted.trackId);
    }
    render(engine.getState());
  });

  return engine;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
