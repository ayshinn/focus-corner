import { backdropPath } from '../backdrop-path';
import type { Theme } from '../tokens';

const SERIF = 'Georgia, "Iowan Old Style", "Hoefler Text", Cambria, serif';
const SANS = '"Helvetica Neue", system-ui, -apple-system, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';

export const cozyDorm: Theme = {
  id: 'cozy-dorm',
  label: 'Cozy Dorm',
  backdrop: {
    type: 'video',
    day: backdropPath('cozy-dorm', 'day'),
    night: backdropPath('cozy-dorm', 'night'),
  },
  day: {
    bg: '#f3ead3',
    fg: '#3a2e1f',
    fgMuted: '#7d6e5b',
    surface: '#faf3e0',
    surfaceElevated: '#fef9eb',
    border: '#e0d4ba',
    accent: '#c08552',
    accentFg: '#ffffff',
    fontDisplay: SERIF,
    fontBody: SANS,
    fontMono: MONO,
  },
  night: {
    bg: '#1a1410',
    fg: '#f0e6d2',
    fgMuted: '#b8a78c',
    surface: '#2a2118',
    surfaceElevated: '#34281d',
    border: '#3d3024',
    accent: '#ddb892',
    accentFg: '#1a1410',
    fontDisplay: SERIF,
    fontBody: SANS,
    fontMono: MONO,
  },
};
