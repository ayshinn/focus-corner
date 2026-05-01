// Resolves a theme's video backdrop URL against Vite's configured base
// path so the same theme module works in dev (`/`) and on GitHub Pages
// (`/focus-corner/`). Files live under `public/themes/<themeId>/`.

export function backdropPath(themeId: string, variant: 'day' | 'night'): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}themes/${themeId}/${variant}.webm`;
}
