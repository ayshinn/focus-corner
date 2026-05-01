// Music hotkeys (space / [ ] / - =). Step 34 introduces a centralized
// hotkey registry; until then these live here with a tiny input-aware
// suppressor so typing in todo / search / inputs doesn't trigger them.
//
// Active only while the Spotify card is mounted (caller wires
// install/uninstall via the returned disposer).

import { getPlayback, next, previous, setVolume, togglePlay } from './playback';

const VOLUME_STEP = 0.05;

function targetIsEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function installSpotifyHotkeys(): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (targetIsEditable(event.target)) return;
    const playback = getPlayback();
    if (playback.mode !== 'ready') return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        void togglePlay();
        return;
      case '[':
        event.preventDefault();
        void previous();
        return;
      case ']':
        event.preventDefault();
        void next();
        return;
      case '-':
        event.preventDefault();
        void setVolume(playback.volume - VOLUME_STEP);
        return;
      case '=':
      case '+':
        event.preventDefault();
        void setVolume(playback.volume + VOLUME_STEP);
        return;
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
