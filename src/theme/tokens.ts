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

// Backdrop configuration. CSS-only themes render via theme-scoped rules
// in styles.css; video themes mount a <video> element on top of those
// rules so a missing/erroring asset gracefully falls back to the CSS
// scene.
export type BackdropConfig =
  | { type: 'css' }
  | { type: 'video'; day: string; night: string };

export interface Theme {
  id: string;
  label: string;
  day: TokenValues;
  night: TokenValues;
  backdrop?: BackdropConfig;
}

export type ThemeVariant = 'day' | 'night' | 'auto';
export type ResolvedVariant = 'day' | 'night';
