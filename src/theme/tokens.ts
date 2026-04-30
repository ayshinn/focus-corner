// Theme token contract. Every theme provides a value for each TOKEN_NAMES
// entry per variant; applyTheme writes them as CSS custom properties on
// <html>. Adding a token means: add the key here, fill it in for every
// registered theme, and reference --name from CSS.

export const TOKEN_NAMES = {
  bg: '--bg',
  fg: '--fg',
  fgMuted: '--fg-muted',
  surface: '--surface',
  surfaceElevated: '--surface-elevated',
  border: '--border',
  accent: '--accent',
  accentFg: '--accent-fg',
  fontDisplay: '--font-display',
  fontBody: '--font-body',
  fontMono: '--font-mono',
} as const;

export type TokenKey = keyof typeof TOKEN_NAMES;
export type TokenValues = Record<TokenKey, string>;

export interface Theme {
  id: string;
  label: string;
  day: TokenValues;
  night: TokenValues;
}

export type ThemeVariant = 'day' | 'night' | 'auto';
export type ResolvedVariant = 'day' | 'night';
