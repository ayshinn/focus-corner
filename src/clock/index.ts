import { getSettings, subscribeSettings } from '../storage/settings';

let targetEl: HTMLElement | null = null;
let timerId: number | null = null;

export function mountClock(el: HTMLElement): void {
  targetEl = el;
  render();
  scheduleTick();
  subscribeSettings(render);
  document.addEventListener('visibilitychange', () => {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    if (!document.hidden) {
      render();
      scheduleTick();
    }
  });
}

function scheduleTick(): void {
  if (timerId !== null) window.clearTimeout(timerId);
  const now = new Date();
  const msUntilNextSecond = 1000 - now.getMilliseconds();
  timerId = window.setTimeout(() => {
    render();
    timerId = null;
    scheduleTick();
  }, msUntilNextSecond);
}

function render(): void {
  if (!targetEl) return;
  const { clockFormat } = getSettings();
  const now = new Date();
  const time = now.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: clockFormat === '12h',
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  targetEl.innerHTML = `<span class="clock-time">${time}</span> <span class="clock-date">${date}</span>`;
}
