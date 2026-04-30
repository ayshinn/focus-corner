import type { Theme } from '../tokens';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';

export const minimal: Theme = {
  id: 'minimal',
  label: 'Minimal',
  day: {
    bg: '#fafaf9',
    fg: '#1a1a1a',
    fgMuted: '#737373',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    border: '#e5e5e5',
    accent: '#3b82f6',
    accentFg: '#ffffff',
    fontDisplay: SANS,
    fontBody: SANS,
    fontMono: MONO,
  },
  night: {
    bg: '#1a1a1a',
    fg: '#e5e5e5',
    fgMuted: '#a3a3a3',
    surface: '#262626',
    surfaceElevated: '#2e2e2e',
    border: '#3a3a3a',
    accent: '#60a5fa',
    accentFg: '#0a0a0a',
    fontDisplay: SANS,
    fontBody: SANS,
    fontMono: MONO,
  },
};
