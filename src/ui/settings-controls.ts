import {
  getSettings,
  subscribeSettings,
  updateSettings,
  type ClockFormat,
  type IntentionMode,
} from '../storage/settings';
import { mountSpotifyConnect } from '../integrations/spotify/ui-connect';
import { mountGoogleConnect } from '../integrations/google/ui-connect';
import { mountStats } from '../stats';
import { mountHabits } from '../habits';

const CLOCK_OPTIONS: Array<{ value: ClockFormat; label: string }> = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
];

type DurationKey = 'work' | 'shortBreak' | 'longBreak';

const DURATION_FIELDS: Array<{ key: DurationKey; label: string; min: number; max: number }> = [
  { key: 'work', label: 'Work', min: 1, max: 180 },
  { key: 'shortBreak', label: 'Short break', min: 1, max: 60 },
  { key: 'longBreak', label: 'Long break', min: 1, max: 120 },
];

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

interface StepperOpts {
  min: number;
  max: number;
  ariaLabel: string;
  dataAttr: string;
  dataValue: string;
}

function stepperHtml(opts: StepperOpts): string {
  return `
    <div class="settings-stepper">
      <button type="button" class="settings-stepper-btn" data-step="-1" aria-label="Decrease ${opts.ariaLabel}" tabindex="-1">−</button>
      <input
        class="settings-stepper-input"
        type="number"
        min="${opts.min}"
        max="${opts.max}"
        step="1"
        ${opts.dataAttr}="${opts.dataValue}"
        aria-label="${opts.ariaLabel}"
      />
      <button type="button" class="settings-stepper-btn" data-step="1" aria-label="Increase ${opts.ariaLabel}" tabindex="-1">+</button>
    </div>
  `;
}

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
    <section class="settings-section">
      <h3>Pomodoro durations (minutes)</h3>
      ${DURATION_FIELDS.map(
        (f) => `
        <div class="settings-row">
          <span class="settings-label">${f.label}</span>
          ${stepperHtml({
            min: f.min,
            max: f.max,
            ariaLabel: `${f.label} duration in minutes`,
            dataAttr: 'data-duration',
            dataValue: f.key,
          })}
        </div>`,
      ).join('')}
    </section>
    <section class="settings-section">
      <h3>Todo</h3>
      <div class="settings-row">
        <span class="settings-label">Clear done after (hours)</span>
        ${stepperHtml({
          min: 1,
          max: 720,
          ariaLabel: 'Clear done after hours',
          dataAttr: 'data-todo-clear',
          dataValue: 'hours',
        })}
      </div>
    </section>
    <section class="settings-section">
      <h3>Integrations</h3>
      <div class="integration-list" data-slot="integrations"></div>
    </section>
    <section class="settings-section">
      <h3>Intention</h3>
      <div class="settings-row">
        <span class="settings-label">Source</span>
        <div class="settings-segmented" data-slot="intention-mode">
          <button type="button" data-value="daily-quote" aria-pressed="false">Quote</button>
          <button type="button" data-value="user-intention" aria-pressed="false">Mine</button>
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h3>Weather</h3>
      <div class="settings-row">
        <span class="settings-label">Source</span>
        <div class="settings-segmented" data-slot="weather-mode">
          <button type="button" data-value="auto" aria-pressed="false">Auto</button>
          <button type="button" data-value="manual" aria-pressed="false">City</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">City</span>
        <input type="text" class="settings-text-input" data-slot="weather-city" placeholder="e.g. Brooklyn, NY" />
      </div>
    </section>
    <section class="settings-section">
      <h3>Habits</h3>
      <div data-slot="habits"></div>
    </section>
    <section class="settings-section">
      <h3>Focus stats</h3>
      <div data-slot="stats"></div>
    </section>
  `;

  const integrationsList = target.querySelector<HTMLElement>('[data-slot="integrations"]');
  if (integrationsList) {
    const spotifyRow = document.createElement('div');
    integrationsList.appendChild(spotifyRow);
    mountSpotifyConnect({ target: spotifyRow });
    const googleRow = document.createElement('div');
    integrationsList.appendChild(googleRow);
    mountGoogleConnect({ target: googleRow });
  }

  const statsSlot = target.querySelector<HTMLElement>('[data-slot="stats"]');
  if (statsSlot) mountStats(statsSlot);

  const habitsSlot = target.querySelector<HTMLElement>('[data-slot="habits"]');
  if (habitsSlot) mountHabits(habitsSlot);

  const intentionMode = target.querySelector<HTMLElement>('[data-slot="intention-mode"]');
  intentionMode?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-value]');
    const value = btn?.dataset.value as IntentionMode | undefined;
    if (value) {
      updateSettings({ intention: { ...getSettings().intention, mode: value } });
    }
  });

  const weatherMode = target.querySelector<HTMLElement>('[data-slot="weather-mode"]');
  weatherMode?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-value]');
    const value = btn?.dataset.value as 'auto' | 'manual' | undefined;
    if (value) updateSettings({ weather: { ...getSettings().weather, mode: value } });
  });

  const weatherCity = target.querySelector<HTMLInputElement>('[data-slot="weather-city"]');
  weatherCity?.addEventListener('change', () => {
    const city = weatherCity.value.trim();
    const next = { ...getSettings().weather };
    if (city) {
      next.city = city;
      // Clear cached coords; geocode runs on next refresh.
      delete next.lat;
      delete next.lon;
    } else {
      delete next.city;
    }
    updateSettings({ weather: next });
  });

  const segmented = target.querySelector<HTMLElement>('[data-slot="clock-format"]');
  segmented?.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-value]');
    const value = btn?.dataset.value as ClockFormat | undefined;
    if (value) updateSettings({ clockFormat: value });
  });

  target.querySelectorAll<HTMLInputElement>('[data-duration]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.duration as DurationKey;
      const field = DURATION_FIELDS.find((f) => f.key === key);
      if (!field) return;
      const next = clamp(input.valueAsNumber, field.min, field.max);
      const current = getSettings().pomodoroDurationsMin;
      updateSettings({
        pomodoroDurationsMin: { ...current, [key]: next },
      });
    });
  });

  const todoClearInput = target.querySelector<HTMLInputElement>('[data-todo-clear="hours"]');
  todoClearInput?.addEventListener('change', () => {
    const next = clamp(todoClearInput.valueAsNumber, 1, 720);
    updateSettings({ todoDoneClearAfterHours: next });
  });

  // Stepper +/- buttons: nudge the sibling input and trigger its change
  // handler so the existing clamp/persist logic runs unchanged.
  target.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('.settings-stepper-btn');
    if (!btn) return;
    const input = btn.parentElement?.querySelector<HTMLInputElement>('.settings-stepper-input');
    if (!input) return;
    const delta = btn.dataset.step === '-1' ? -1 : 1;
    const min = Number(input.min);
    const max = Number(input.max);
    const current = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : min;
    input.value = String(clamp(current + delta, min, max));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const sync = (): void => {
    const settings = getSettings();
    target
      .querySelectorAll<HTMLElement>('[data-slot="clock-format"] [data-value]')
      .forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.value === settings.clockFormat));
      });
    target
      .querySelectorAll<HTMLElement>('[data-slot="intention-mode"] [data-value]')
      .forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.value === settings.intention.mode));
      });
    target
      .querySelectorAll<HTMLElement>('[data-slot="weather-mode"] [data-value]')
      .forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.value === settings.weather.mode));
      });
    target.querySelectorAll<HTMLInputElement>('[data-duration]').forEach((input) => {
      const key = input.dataset.duration as DurationKey;
      input.value = String(settings.pomodoroDurationsMin[key]);
    });
    if (todoClearInput) {
      todoClearInput.value = String(settings.todoDoneClearAfterHours);
    }
    if (weatherCity) {
      weatherCity.value = settings.weather.city ?? '';
    }
  };

  sync();
  subscribeSettings(sync);
}
