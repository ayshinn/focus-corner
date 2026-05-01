// Theme-driven backdrop. Themes can declare either a CSS-only scene (the
// default) or a video pair (day + night). Video themes always paint the
// theme-scoped CSS rules from styles.css underneath so that a missing
// or erroring asset visually degrades to the CSS scene.
//
// Page Visibility API: pause the video and the CSS scene animations
// when the tab is hidden; resume the video on focus only if it was
// playing before.

import { getPref, getTheme, subscribe } from '../theme';
import type { BackdropConfig } from '../theme/tokens';

let backdropEl: HTMLElement | null = null;
let videoEl: HTMLVideoElement | null = null;
let wasPlayingBeforeHide = false;

export function mountBackdrop(target: HTMLElement): void {
  backdropEl = document.createElement('div');
  backdropEl.className = 'backdrop';
  backdropEl.setAttribute('aria-hidden', 'true');
  backdropEl.setAttribute('data-paused', 'false');
  target.prepend(backdropEl);

  syncToTheme();
  syncPaused();

  document.addEventListener('visibilitychange', onVisibility);
  subscribe(syncToTheme);
}

function syncPaused(): void {
  backdropEl?.setAttribute('data-paused', String(document.hidden));
}

function onVisibility(): void {
  syncPaused();
  if (!videoEl) return;
  if (document.hidden) {
    wasPlayingBeforeHide = !videoEl.paused;
    videoEl.pause();
  } else if (wasPlayingBeforeHide) {
    void videoEl.play().catch(() => {});
  }
}

function resolveVariant(): 'day' | 'night' {
  const pref = getPref();
  if (pref.variant !== 'auto') return pref.variant;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'day';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

function ensureVideoEl(): HTMLVideoElement {
  if (videoEl) return videoEl;
  const el = document.createElement('video');
  el.className = 'backdrop-video';
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.autoplay = true;
  el.preload = 'auto';
  el.setAttribute('aria-hidden', 'true');
  el.addEventListener('error', () => {
    backdropEl?.setAttribute('data-video-error', 'true');
  });
  el.addEventListener('loadeddata', () => {
    backdropEl?.removeAttribute('data-video-error');
  });
  backdropEl?.appendChild(el);
  videoEl = el;
  return el;
}

function removeVideoEl(): void {
  if (!videoEl) return;
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
  videoEl.remove();
  videoEl = null;
  backdropEl?.removeAttribute('data-video-error');
}

function syncToTheme(): void {
  if (!backdropEl) return;
  const pref = getPref();
  const theme = getTheme(pref.themeId);
  const backdrop: BackdropConfig = theme?.backdrop ?? { type: 'css' };
  backdropEl.setAttribute('data-backdrop', backdrop.type);

  if (backdrop.type === 'css') {
    removeVideoEl();
    return;
  }

  const variant = resolveVariant();
  const src = variant === 'night' ? backdrop.night : backdrop.day;
  const video = ensureVideoEl();
  const absolute = new URL(src, document.baseURI).href;
  if (video.src !== absolute) {
    backdropEl.removeAttribute('data-video-error');
    video.src = src;
    void video.play().catch(() => {});
  }
}
