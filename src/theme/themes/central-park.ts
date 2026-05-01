import { backdropPath } from '../backdrop-path';
import type { Theme } from '../tokens';

const SANS = '"Helvetica Neue", system-ui, -apple-system, sans-serif';
const DISPLAY = '"Avenir Next", "Helvetica Neue", system-ui, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';

export const centralPark: Theme = {
  id: 'central-park',
  label: 'Central Park',
  backdrop: {
    type: 'video',
    day: backdropPath('central-park', 'day'),
    night: backdropPath('central-park', 'night'),
  },
  day: {
    bg: '#c5d4a8',
    fg: '#1f2914',
    fgMuted: '#6c7c4f',
    surface: '#d8e3bc',
    surfaceElevated: '#e6edcb',
    border: '#b1c08e',
    accent: '#527d2f',
    accentFg: '#ffffff',
    fontDisplay: DISPLAY,
    fontBody: SANS,
    fontMono: MONO,
  },
  night: {
    bg: '#0c1810',
    fg: '#d8e6c8',
    fgMuted: '#80917a',
    surface: '#162820',
    surfaceElevated: '#1d3327',
    border: '#2a3f33',
    accent: '#f6c761',
    accentFg: '#0c1810',
    fontDisplay: DISPLAY,
    fontBody: SANS,
    fontMono: MONO,
  },
};
