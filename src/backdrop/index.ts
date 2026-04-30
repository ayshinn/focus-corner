// Theme-driven backdrop. For now only the Minimal theme has a CSS-only
// scene (see styles.css). Phase 2 introduces a video pipeline.

let backdropEl: HTMLElement | null = null;

export function mountBackdrop(target: HTMLElement): void {
  const el = document.createElement('div');
  el.className = 'backdrop';
  el.setAttribute('data-paused', 'false');
  el.setAttribute('aria-hidden', 'true');
  target.prepend(el);
  backdropEl = el;
  syncPaused();
  document.addEventListener('visibilitychange', syncPaused);
}

function syncPaused(): void {
  backdropEl?.setAttribute('data-paused', String(document.hidden));
}
