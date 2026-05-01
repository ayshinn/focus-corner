import { backdropPath } from '../backdrop-path';
import type { Theme } from '../tokens';

const SERIF = '"Iowan Old Style", Garamond, "Times New Roman", serif';
const SANS = '"Helvetica Neue", system-ui, -apple-system, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';

export const library: Theme = {
  id: 'library',
  label: 'Library',
  backdrop: {
    type: 'video',
    day: backdropPath('library', 'day'),
    night: backdropPath('library', 'night'),
  },
  day: {
    bg: '#ede0c8',
    fg: '#2d2419',
    fgMuted: '#80715a',
    surface: '#f5e9d0',
    surfaceElevated: '#fbf2db',
    border: '#d4c2a0',
    accent: '#8b5a2b',
    accentFg: '#ffffff',
    fontDisplay: SERIF,
    fontBody: SANS,
    fontMono: MONO,
  },
  night: {
    bg: '#0e0a06',
    fg: '#e8d9b8',
    fgMuted: '#a6906c',
    surface: '#1c1610',
    surfaceElevated: '#251d14',
    border: '#332817',
    accent: '#d4a76a',
    accentFg: '#0e0a06',
    fontDisplay: SERIF,
    fontBody: SANS,
    fontMono: MONO,
  },
};
