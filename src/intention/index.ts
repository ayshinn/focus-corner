// Daily intention / quote line. Two modes (settings drawer toggle):
//   - daily-quote: deterministic pick from a small bundled pool, keyed
//     by today's local date so it stays the same all day.
//   - user-intention: a textarea-style line the user fills in once a
//     day; the value is keyed by date so old days don't bleed into new.

import { getSettings, subscribeSettings, updateSettings } from '../storage/settings';

const QUOTES = [
  'Discipline is choosing between what you want now and what you want most.',
  'You don\'t have to be great to start, but you have to start to be great.',
  'Small steps every day.',
  'Done is better than perfect.',
  'Slow is smooth, smooth is fast.',
  'The cave you fear to enter holds the treasure you seek.',
  'Make the work the point.',
  'Quiet hands. Quiet mind. Quiet work.',
  'Begin again.',
  'One thing at a time.',
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function dailyQuote(): string {
  // Hash the date into a quote index so the line stays stable until
  // tomorrow.
  const key = todayKey();
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % QUOTES.length;
  return QUOTES[idx]!;
}

export function mountIntention(target: HTMLElement): void {
  target.classList.add('topbar-intention');
  target.innerHTML = `
    <span class="intention-text" data-slot="text"></span>
    <button type="button" class="intention-edit" data-action="edit" hidden aria-label="Edit intention">✎</button>
  `;
  const textEl = target.querySelector<HTMLElement>('[data-slot="text"]')!;
  const editBtn = target.querySelector<HTMLButtonElement>('[data-action="edit"]')!;

  function render(): void {
    const settings = getSettings();
    if (settings.intention.mode === 'daily-quote') {
      textEl.textContent = dailyQuote();
      textEl.dataset.empty = 'false';
      editBtn.hidden = true;
      target.classList.remove('topbar-intention-editing');
      return;
    }
    const today = settings.intention.byDate[todayKey()] ?? '';
    if (today.trim().length === 0) {
      textEl.textContent = 'Set today\'s intention…';
      textEl.dataset.empty = 'true';
    } else {
      textEl.textContent = today;
      textEl.dataset.empty = 'false';
    }
    editBtn.hidden = false;
  }

  function startEdit(): void {
    const current = getSettings().intention.byDate[todayKey()] ?? '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'intention-input';
    input.value = current;
    input.maxLength = 240;
    input.placeholder = 'Today\'s intention';
    target.replaceChildren(input);
    input.focus();
    input.select();
    const finish = (save: boolean): void => {
      if (save) {
        const settings = getSettings();
        const byDate = { ...settings.intention.byDate, [todayKey()]: input.value.trim() };
        updateSettings({ intention: { ...settings.intention, byDate } });
      }
      target.replaceChildren(textEl, editBtn);
      render();
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  textEl.addEventListener('click', () => {
    if (getSettings().intention.mode === 'user-intention') startEdit();
  });
  editBtn.addEventListener('click', startEdit);

  render();
  subscribeSettings(render);
  // Re-render at midnight so the daily key flips.
  function scheduleMidnight(): void {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    window.setTimeout(() => {
      render();
      scheduleMidnight();
    }, next.getTime() - now.getTime() + 500);
  }
  scheduleMidnight();
}
