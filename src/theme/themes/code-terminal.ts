import { backdropPath } from '../backdrop-path';
import type { Theme } from '../tokens';

const MONO = '"JetBrains Mono", "SF Mono", Menlo, "Cascadia Code", Consolas, monospace';

export const codeTerminal: Theme = {
  id: 'code-terminal',
  label: 'Code Terminal',
  backdrop: {
    type: 'video',
    day: backdropPath('code-terminal', 'day'),
    night: backdropPath('code-terminal', 'night'),
  },
  day: {
    bg: '#f6f6f4',
    fg: '#1a1a1a',
    fgMuted: '#6a6a6a',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    border: '#d6d6d4',
    accent: '#057a55',
    accentFg: '#ffffff',
    fontDisplay: MONO,
    fontBody: MONO,
    fontMono: MONO,
  },
  night: {
    bg: '#000000',
    fg: '#00ff8a',
    fgMuted: '#2da66f',
    surface: '#050505',
    surfaceElevated: '#0a0a0a',
    border: '#1f1f1f',
    accent: '#00ff8a',
    accentFg: '#000000',
    fontDisplay: MONO,
    fontBody: MONO,
    fontMono: MONO,
  },
};
