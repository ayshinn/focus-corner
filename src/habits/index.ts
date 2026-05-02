// Habits widget. Lives in the settings drawer (a small list of named
// habits with a today-checkbox and a last-30-days dot row each).
// Persistence is IDB-backed via store.ts.

import { deleteHabit, listHabits, putHabit, type Habit } from './store';

const GRID_DAYS = 30;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nowId(): string {
  return `habit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

function toggleDate(habit: Habit, key: string): Habit {
  const set = new Set(habit.dates);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  return { ...habit, dates: Array.from(set).sort() };
}

export function mountHabits(target: HTMLElement): void {
  target.classList.add('habits-section');
  target.innerHTML = `
    <ul class="habits-list" data-slot="list"></ul>
    <form class="habits-add" data-slot="add">
      <input type="text" maxlength="60" placeholder="New habit (e.g. Read 20 min)" aria-label="New habit name" />
      <button type="submit">Add</button>
    </form>
  `;

  const listEl = target.querySelector<HTMLElement>('[data-slot="list"]')!;
  const form = target.querySelector<HTMLFormElement>('[data-slot="add"]')!;
  const input = form.querySelector<HTMLInputElement>('input')!;

  let habits: Habit[] = [];

  function render(): void {
    const days = lastNDays(GRID_DAYS);
    const today = todayKey();
    if (habits.length === 0) {
      listEl.innerHTML = `<li class="habits-empty">No habits yet. Add one below.</li>`;
      return;
    }
    listEl.innerHTML = habits
      .map((h) => {
        const completedToday = h.dates.includes(today);
        const grid = days
          .map((k) => {
            const filled = h.dates.includes(k);
            return `<span class="habits-cell ${filled ? 'on' : ''}" title="${escapeHtml(k)}"></span>`;
          })
          .join('');
        return `<li class="habits-row" data-id="${escapeHtml(h.id)}">
          <label class="habits-check">
            <input type="checkbox" ${completedToday ? 'checked' : ''} aria-label="Done today: ${escapeHtml(h.name)}" />
            <span class="habits-name">${escapeHtml(h.name)}</span>
          </label>
          <div class="habits-grid">${grid}</div>
          <button type="button" class="habits-delete" data-action="delete" aria-label="Delete habit">×</button>
        </li>`;
      })
      .join('');
  }

  async function refresh(): Promise<void> {
    habits = await listHabits();
    render();
  }

  listEl.addEventListener('change', (event) => {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.tagName !== 'INPUT' || checkbox.type !== 'checkbox') return;
    const row = checkbox.closest<HTMLElement>('[data-id]');
    if (!row) return;
    const id = row.dataset.id!;
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    const next = toggleDate(habit, todayKey());
    habits = habits.map((h) => (h.id === id ? next : h));
    void putHabit(next);
    render();
  });

  listEl.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action="delete"]');
    if (!btn) return;
    const row = btn.closest<HTMLElement>('[data-id]');
    if (!row) return;
    const id = row.dataset.id!;
    habits = habits.filter((h) => h.id !== id);
    void deleteHabit(id);
    render();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const habit: Habit = {
      id: nowId(),
      name,
      createdAt: Date.now(),
      dates: [],
    };
    habits = [...habits, habit];
    input.value = '';
    void putHabit(habit);
    render();
  });

  render();
  void refresh();
}
