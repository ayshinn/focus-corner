import { read, write } from '../storage/versioned';
import {
  TOKEN_NAMES,
  type ResolvedVariant,
  type Theme,
  type ThemeVariant,
  type TokenKey,
} from './tokens';

const KEY = 'theme';
const VERSION = 1;

export interface ThemePref {
  themeId: string;
  variant: ThemeVariant;
}

const DEFAULT_PREF: ThemePref = { themeId: 'minimal', variant: 'auto' };

const registry = new Map<string, Theme>();
const listeners = new Set<(pref: ThemePref) => void>();

let currentPref: ThemePref = DEFAULT_PREF;
let unlistenSystem: (() => void) | null = null;

export function registerTheme(theme: Theme): void {
  registry.set(theme.id, theme);
}

export function getTheme(id: string): Theme | undefined {
  return registry.get(id);
}

export function listThemes(): Theme[] {
  return Array.from(registry.values());
}

export function getPref(): ThemePref {
  return { ...currentPref };
}

export function subscribe(listener: (pref: ThemePref) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolveVariant(variant: ThemeVariant): ResolvedVariant {
  if (variant !== 'auto') return variant;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'day';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

export function applyTheme(themeId: string, variant: ThemeVariant): void {
  const theme = registry.get(themeId);
  if (!theme) return;
  const resolved = resolveVariant(variant);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-variant', resolved);
  const tokens = resolved === 'day' ? theme.day : theme.night;
  for (const key of Object.keys(TOKEN_NAMES) as TokenKey[]) {
    root.style.setProperty(TOKEN_NAMES[key], tokens[key]);
  }
}

function teardownSystemListener(): void {
  unlistenSystem?.();
  unlistenSystem = null;
}

function setupSystemListener(): void {
  teardownSystemListener();
  if (currentPref.variant !== 'auto') return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => applyTheme(currentPref.themeId, 'auto');
  mq.addEventListener('change', handler);
  unlistenSystem = () => mq.removeEventListener('change', handler);
}

function notify(): void {
  for (const listener of listeners) listener(getPref());
}

export function setPref(pref: ThemePref): void {
  currentPref = { ...pref };
  write(KEY, VERSION, currentPref);
  applyTheme(currentPref.themeId, currentPref.variant);
  setupSystemListener();
  notify();
}

export function setVariant(variant: ThemeVariant): void {
  setPref({ ...currentPref, variant });
}

export function setTheme(themeId: string): void {
  setPref({ ...currentPref, themeId });
}

// Hydrates the theme before first paint. Call this in main.ts before any
// component mounts so paint sees the right tokens / data attributes.
export function bootstrapTheme(): void {
  const stored = read<ThemePref>(KEY, VERSION);
  currentPref = stored ?? { ...DEFAULT_PREF };
  applyTheme(currentPref.themeId, currentPref.variant);
  setupSystemListener();
}
