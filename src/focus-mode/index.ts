// Focus mode: hides everything except pomodoro + clock; backdrop is
// full-bleed. The toggle is exposed via a sidebar button and the
// hotkey "f" registered through the global hotkey system.

import { registerHotkey } from '../hotkeys';

const KEY = 'focus-corner-focus-mode';

function isOn(): boolean {
  return document.documentElement.dataset.focusMode === 'true';
}

function apply(on: boolean): void {
  document.documentElement.dataset.focusMode = String(on);
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function toggleFocusMode(): void {
  apply(!isOn());
}

export function setFocusMode(on: boolean): void {
  apply(on);
}

export function isFocusMode(): boolean {
  return isOn();
}

export function initFocusMode(): void {
  let stored = false;
  try {
    stored = localStorage.getItem(KEY) === '1';
  } catch {
    /* ignore */
  }
  apply(stored);

  registerHotkey({
    key: 'f',
    description: 'Toggle focus mode',
    section: 'General',
    handler: () => toggleFocusMode(),
  });
}
