// Spotify music hotkeys, registered through the global hotkey registry.
// Spec §5.4 lists space / [ ] / - = ; the registry handles the
// input-aware suppression so we don't repeat that logic here.

import { registerHotkey } from '../../hotkeys';
import { getPlayback, next, previous, setVolume, togglePlay } from './playback';

const VOLUME_STEP = 0.05;

function whenReady(fn: () => void | Promise<void>): () => void {
  return () => {
    if (getPlayback().mode !== 'ready') return;
    void fn();
  };
}

export function installSpotifyHotkeys(): () => void {
  const disposers = [
    registerHotkey({
      key: ' ',
      description: 'Play / pause Spotify',
      section: 'Music',
      handler: whenReady(togglePlay),
    }),
    registerHotkey({
      key: '[',
      description: 'Previous track',
      section: 'Music',
      handler: whenReady(previous),
    }),
    registerHotkey({
      key: ']',
      description: 'Next track',
      section: 'Music',
      handler: whenReady(next),
    }),
    registerHotkey({
      key: '-',
      description: 'Volume down',
      section: 'Music',
      handler: whenReady(() => setVolume(getPlayback().volume - VOLUME_STEP)),
    }),
    registerHotkey({
      key: '=',
      description: 'Volume up',
      section: 'Music',
      handler: whenReady(() => setVolume(getPlayback().volume + VOLUME_STEP)),
    }),
  ];
  return () => disposers.forEach((d) => d());
}
