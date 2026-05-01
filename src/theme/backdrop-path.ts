// Resolves a theme asset URL against Vite's configured base path so the
// same theme module works in dev (`/`) and on GitHub Pages
// (`/focus-corner/`). Files live under `public/themes/<themeId>/`.

function basePath(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

export function backdropPath(themeId: string, variant: 'day' | 'night'): string {
  return `${basePath()}themes/${themeId}/${variant}.webm`;
}

export function themeAssetPath(themeId: string, file: string): string {
  return `${basePath()}themes/${themeId}/${file}`;
}
