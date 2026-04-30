// Settings drawer is a stub. Step 14 starts populating it.

let drawerEl: HTMLElement | null = null;

export function mountSettingsDrawer(target: HTMLElement): void {
  drawerEl = target;
  const closeBtn = target.querySelector<HTMLButtonElement>('[data-action="close-settings"]');
  closeBtn?.addEventListener('click', () => closeSettings());
}

export function openSettings(): void {
  drawerEl?.setAttribute('data-open', 'true');
}

export function closeSettings(): void {
  drawerEl?.setAttribute('data-open', 'false');
}

export function toggleSettings(): void {
  if (!drawerEl) return;
  if (drawerEl.getAttribute('data-open') === 'true') {
    closeSettings();
  } else {
    openSettings();
  }
}
