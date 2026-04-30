// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  bootstrapTheme,
  getPref,
  registerTheme,
  setPref,
  setTheme,
  setVariant,
  subscribe,
} from './index';
import { minimal } from './themes/minimal';

interface MqMock {
  matches: boolean;
  listeners: Array<() => void>;
  fireChange(): void;
}

function installMatchMedia(matches: boolean): MqMock {
  const mock: MqMock = {
    matches,
    listeners: [],
    fireChange() {
      for (const fn of this.listeners) fn();
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: mock.matches,
      addEventListener: (_: string, fn: () => void) => mock.listeners.push(fn),
      removeEventListener: (_: string, fn: () => void) => {
        mock.listeners = mock.listeners.filter((x) => x !== fn);
      },
    })),
  });
  return mock;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-variant');
  document.documentElement.removeAttribute('style');
  registerTheme(minimal);
  installMatchMedia(false);
  // Reset internal state by re-bootstrapping into defaults.
  bootstrapTheme();
});

describe('theme', () => {
  it('defaults to minimal + auto when no stored pref', () => {
    expect(getPref()).toEqual({ themeId: 'minimal', variant: 'auto' });
  });

  it('writes data attributes and CSS variables on apply', () => {
    applyTheme('minimal', 'day');
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('minimal');
    expect(root.getAttribute('data-variant')).toBe('day');
    expect(root.style.getPropertyValue('--bg')).toBe('#fafaf9');
  });

  it('applies night when variant=auto and system prefers dark', () => {
    installMatchMedia(true);
    applyTheme('minimal', 'auto');
    expect(document.documentElement.getAttribute('data-variant')).toBe('night');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#1a1a1a');
  });

  it('persists pref via setPref and survives reload', () => {
    setPref({ themeId: 'minimal', variant: 'night' });
    bootstrapTheme();
    expect(getPref()).toEqual({ themeId: 'minimal', variant: 'night' });
    expect(document.documentElement.getAttribute('data-variant')).toBe('night');
  });

  it('subscribers fire on setVariant / setTheme', () => {
    const seen: string[] = [];
    const off = subscribe((p) => seen.push(p.variant));
    setVariant('day');
    setVariant('night');
    off();
    setVariant('day');
    expect(seen).toEqual(['day', 'night']);
  });

  it('reapplies on system change while variant=auto', () => {
    const mq = installMatchMedia(false);
    setPref({ themeId: 'minimal', variant: 'auto' });
    expect(document.documentElement.getAttribute('data-variant')).toBe('day');
    mq.matches = true;
    mq.fireChange();
    expect(document.documentElement.getAttribute('data-variant')).toBe('night');
  });

  it('ignores system change when variant is explicit', () => {
    const mq = installMatchMedia(false);
    setPref({ themeId: 'minimal', variant: 'day' });
    mq.matches = true;
    mq.fireChange();
    expect(document.documentElement.getAttribute('data-variant')).toBe('day');
  });

  it('setTheme leaves variant intact', () => {
    setPref({ themeId: 'minimal', variant: 'night' });
    setTheme('minimal');
    expect(getPref().variant).toBe('night');
  });
});
