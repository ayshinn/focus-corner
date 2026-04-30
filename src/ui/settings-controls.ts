import { getSettings, subscribeSettings, updateSettings, type ClockFormat } from '../storage/settings';

const CLOCK_OPTIONS: Array<{ value: ClockFormat; label: string }> = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
];

export function mountSettingsControls(target: HTMLElement): void {
  target.innerHTML = `
    <section class="settings-section">
      <h3>Clock</h3>
      <div class="settings-row">
        <span class="settings-label">Format</span>
        <div class="settings-segmented" data-slot="clock-format">
          ${CLOCK_OPTIONS.map(
            (opt) =>
              `<button type="button" data-value="${opt.value}" aria-pressed="false">${opt.label}</button>`,
          ).join('')}
        </div>
      </div>
    </section>
  `;

  const segmented = target.querySelector<HTMLElement>('[data-slot="clock-format"]');
  segmented?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-value]');
    const value = btn?.dataset.value as ClockFormat | undefined;
    if (value) updateSettings({ clockFormat: value });
  });

  const sync = (): void => {
    const { clockFormat } = getSettings();
    target.querySelectorAll<HTMLElement>('[data-value]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.value === clockFormat));
    });
  };

  sync();
  subscribeSettings(sync);
}
