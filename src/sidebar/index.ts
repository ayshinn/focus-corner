import { getPref, listThemes, setTheme, setVariant, subscribe } from '../theme';
import type { ThemeVariant } from '../theme/tokens';
import { gearIcon } from '../ui/icons';
import { toggleSettings } from '../ui/settings-drawer';

const VARIANTS: Array<{ id: ThemeVariant; label: string }> = [
  { id: 'day', label: 'Day' },
  { id: 'night', label: 'Night' },
  { id: 'auto', label: 'Auto' },
];

export function mountSidebar(target: HTMLElement): void {
  target.innerHTML = `
    <div class="theme-picker" data-slot="theme-picker"></div>
    <div class="variant-toggle" data-slot="variant-toggle">
      ${VARIANTS.map(
        (v) => `<button type="button" data-variant="${v.id}" aria-pressed="false">${v.label}</button>`,
      ).join('')}
    </div>
    <div class="sidebar-spacer"></div>
    <button type="button" class="gear-button" data-action="open-settings" aria-label="Settings">
      ${gearIcon}
    </button>
  `;

  const picker = target.querySelector<HTMLElement>('[data-slot="theme-picker"]')!;
  picker.innerHTML = listThemes()
    .map(
      (t) =>
        `<button type="button" class="theme-card" data-theme="${t.id}" aria-label="${t.label} theme" aria-pressed="false" title="${t.label}"></button>`,
    )
    .join('');

  picker.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const themeId = target.closest<HTMLElement>('[data-theme]')?.dataset.theme;
    if (themeId) setTheme(themeId);
  });

  const variantEl = target.querySelector<HTMLElement>('[data-slot="variant-toggle"]')!;
  variantEl.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-variant]');
    if (btn?.dataset.variant) setVariant(btn.dataset.variant as ThemeVariant);
  });

  target.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
    toggleSettings();
  });

  const sync = (): void => {
    const pref = getPref();
    target.querySelectorAll<HTMLElement>('[data-theme]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.theme === pref.themeId));
    });
    target.querySelectorAll<HTMLElement>('[data-variant]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.variant === pref.variant));
    });
  };

  sync();
  subscribe(sync);
}
