// Music slot coordinator. Owns the floating music card and swaps the
// default <audio> player UI for the Spotify Web Playback UI when the
// user is connected. Spec §5.4: Spotify takes precedence when active;
// non-Premium / errored connections fall back to default music with a
// message.

import { mountSpotifyPlayback } from '../integrations/spotify/playback-ui';
import {
  getPlayback,
  subscribePlayback,
  type PlaybackMode,
} from '../integrations/spotify/playback';
import { getTokens, subscribeTokens } from '../integrations/spotify/store';
import { mountDefaultMusic } from './default-music';
import type { AudioEngine } from './engine';

function shouldUseSpotify(mode: PlaybackMode): boolean {
  // Spotify UI owns the slot for any mode except the explicit fall-back
  // states. `inactive` is the initial mode before the SDK boots; mounting
  // the Spotify UI is what triggers `ensurePlayer()` and flips the mode
  // forward, so we must not gate on `connecting`/`ready` here.
  return mode !== 'no-premium' && mode !== 'error';
}

export function mountMusic(target: HTMLElement): void {
  let defaultUi: { unmount: () => void; engine: AudioEngine } | null = null;
  let spotifyUi: { unmount: () => void } | null = null;
  let active: 'default' | 'spotify' | null = null;

  function clear(): void {
    defaultUi?.unmount();
    defaultUi = null;
    spotifyUi?.unmount();
    spotifyUi = null;
    target.innerHTML = '';
    target.removeAttribute('data-music-mode');
  }

  function mountTarget(mode: 'default' | 'spotify'): void {
    if (active === mode) return;
    clear();
    if (mode === 'spotify') {
      spotifyUi = mountSpotifyPlayback(target);
      target.dataset.musicMode = 'spotify';
    } else {
      defaultUi = mountDefaultMusic(target);
      target.dataset.musicMode = 'default';
      // Pause default audio if Spotify just took over previously and is
      // now stepping aside; the engine starts paused, so this is a no-op
      // on first mount.
    }
    active = mode;
  }

  function decide(): void {
    const tokens = getTokens();
    if (!tokens) {
      mountTarget('default');
      return;
    }
    const playback = getPlayback();
    if (shouldUseSpotify(playback.mode)) {
      // Pause default music when Spotify takes the slot so the bundled
      // track and Spotify aren't both audible.
      defaultUi?.engine.pause();
      mountTarget('spotify');
    } else {
      mountTarget('default');
    }
  }

  decide();
  subscribeTokens(decide);
  subscribePlayback(decide);
}
