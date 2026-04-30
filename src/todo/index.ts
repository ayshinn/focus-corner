// Floating todo card. Two columns (Today / Tomorrow) over the backdrop.
// Persists every change through the versioned store. The top-bar Current
// Task slot reads the first non-done item of Today live.

import { setCurrentTask } from '../current-task';
import { getSettings, subscribeSettings } from '../storage/settings';
import { read, write } from '../storage/versioned';
import {
  COLUMNS,
  createTodoStore,
  loadTodoState,
  saveTodoState,
  type ColumnId,
  type TodoItem,
  type TodoState,
  type TodoStore,
} from './state';

const AUTO_CLEAR_INTERVAL_MS = 5 * 60 * 1000;
const ROLL_DATE_KEY = 'todoLastRollDate';
const ROLL_DATE_VERSION = 1;
const DRAG_THRESHOLD_PX = 6;

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 5); // a small fudge so we land just past midnight
  return Math.max(1000, next.getTime() - now.getTime());
}

const COLUMN_LABEL: Record<ColumnId, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function topActiveTodayText(state: TodoState): string | null {
  const item = state.today.find((i) => !i.done);
  return item ? item.text : null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderItem(item: TodoItem): string {
  return `
    <li class="todo-item" data-id="${item.id}" data-done="${String(item.done)}">
      <label class="todo-check">
        <input type="checkbox" data-action="toggle" ${item.done ? 'checked' : ''} aria-label="Mark done" />
      </label>
      <span class="todo-text" data-action="edit" tabindex="0">${escapeHtml(item.text)}</span>
    </li>
  `;
}

function renderColumn(column: ColumnId, items: TodoItem[]): string {
  return `
    <section class="todo-column" data-column="${column}">
      <header class="todo-column-header">
        <h3>${COLUMN_LABEL[column]}</h3>
        <span class="todo-count" data-slot="count">${items.length}</span>
      </header>
      <ul class="todo-list" data-list="${column}">
        ${items.map(renderItem).join('')}
      </ul>
      <form class="todo-add" data-add="${column}" autocomplete="off">
        <input
          type="text"
          class="todo-input"
          name="text"
          placeholder="Add to ${COLUMN_LABEL[column]}"
          aria-label="Add to ${COLUMN_LABEL[column]}"
        />
      </form>
    </section>
  `;
}

export function mountTodo(target: HTMLElement): TodoStore {
  const store = createTodoStore({
    initial: loadTodoState(),
    onChange: (state) => saveTodoState(state),
  });

  target.innerHTML = `
    <div class="todo-columns">
      ${COLUMNS.map((c) => renderColumn(c, store.getState()[c])).join('')}
    </div>
  `;

  // ---- Add ----
  target.querySelectorAll<HTMLFormElement>('[data-add]').forEach((form) => {
    const column = form.dataset.add as ColumnId;
    const input = form.querySelector<HTMLInputElement>('input[name="text"]')!;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value;
      if (text.trim() === '') return;
      store.dispatch({
        type: 'add',
        column,
        text,
        id: newId(),
        createdAt: Date.now(),
      });
      input.value = '';
    });
  });

  // ---- Toggle done ----
  target.addEventListener('change', (event) => {
    const el = event.target as HTMLElement;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.dataset.action !== 'toggle') return;
    const li = el.closest<HTMLElement>('[data-id]');
    if (!li) return;
    store.dispatch({ type: 'toggleDone', id: li.dataset.id!, now: Date.now() });
  });

  // ---- Inline edit ----
  target.addEventListener('click', (event) => {
    const span = (event.target as HTMLElement).closest<HTMLElement>('.todo-text');
    if (!span) return;
    const li = span.closest<HTMLElement>('[data-id]');
    if (!li) return;
    beginEdit(span, li.dataset.id!);
  });

  function beginEdit(span: HTMLElement, id: string): void {
    if (span.dataset.editing === 'true') return;
    span.dataset.editing = 'true';
    const original = span.textContent ?? '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'todo-edit-input';
    input.value = original;
    span.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit: boolean): void => {
      if (finished) return;
      finished = true;
      const replacement = document.createElement('span');
      replacement.className = 'todo-text';
      replacement.dataset.action = 'edit';
      replacement.tabIndex = 0;
      replacement.textContent = commit ? input.value.trim() || original : original;
      input.replaceWith(replacement);
      if (commit) {
        const trimmed = input.value.trim();
        if (trimmed !== '' && trimmed !== original) {
          store.dispatch({ type: 'edit', id, text: trimmed });
        }
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  // ---- Render on state change ----
  function render(state: TodoState): void {
    for (const column of COLUMNS) {
      const list = target.querySelector<HTMLElement>(`[data-list="${column}"]`);
      const count = target.querySelector<HTMLElement>(
        `[data-column="${column}"] [data-slot="count"]`,
      );
      if (list) list.innerHTML = state[column].map(renderItem).join('');
      if (count) count.textContent = String(state[column].length);
    }
    setCurrentTask(topActiveTodayText(state));
  }

  store.subscribe(render);
  render(store.getState());

  // ---- Auto-clear done items older than the configured TTL ----
  function dispatchAutoClear(): void {
    const ttlHours = getSettings().todoDoneClearAfterHours;
    const ttlMs = Math.max(1, ttlHours) * 60 * 60 * 1000;
    store.dispatch({ type: 'autoClear', ttlMs, now: Date.now() });
  }
  dispatchAutoClear();
  window.setInterval(dispatchAutoClear, AUTO_CLEAR_INTERVAL_MS);
  subscribeSettings(dispatchAutoClear);

  // ---- Midnight roll: Tomorrow → Today at local midnight ----
  function maybeRollForToday(): void {
    const today = localDateString(new Date());
    const last = read<string>(ROLL_DATE_KEY, ROLL_DATE_VERSION);
    if (last === today) return;
    if (last === null) {
      // First run on this device — record today and skip the roll so a
      // freshly-loaded Tomorrow column doesn't immediately collapse.
      write(ROLL_DATE_KEY, ROLL_DATE_VERSION, today);
      return;
    }
    if (last < today) {
      store.dispatch({ type: 'rollMidnight' });
    }
    write(ROLL_DATE_KEY, ROLL_DATE_VERSION, today);
  }
  maybeRollForToday();
  let midnightTimer: number | null = null;
  function scheduleMidnight(): void {
    if (midnightTimer !== null) window.clearTimeout(midnightTimer);
    midnightTimer = window.setTimeout(() => {
      maybeRollForToday();
      scheduleMidnight();
    }, msUntilNextLocalMidnight(new Date()));
  }
  scheduleMidnight();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) maybeRollForToday();
  });

  // ---- Drag and drop (Pointer Events) ----
  setupDrag(target, store);

  return store;
}

interface DropTarget {
  column: ColumnId;
  index: number;
}

function computeDrop(
  x: number,
  y: number,
  root: HTMLElement,
  draggingId: string,
): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const columnEl = (el as Element).closest<HTMLElement>('[data-column]');
  if (!columnEl || !root.contains(columnEl)) return null;
  const column = columnEl.dataset.column as ColumnId;
  const list = columnEl.querySelector<HTMLElement>('.todo-list');
  if (!list) return null;
  const items = Array.from(list.querySelectorAll<HTMLElement>('.todo-item')).filter(
    (item) => item.dataset.id !== draggingId,
  );
  if (items.length === 0) return { column, index: 0 };
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item) continue;
    const rect = item.getBoundingClientRect();
    if (y < rect.top + rect.height / 2) return { column, index: i };
  }
  return { column, index: items.length };
}

function clearDropIndicator(root: HTMLElement): void {
  root.querySelectorAll('.todo-drop-before, .todo-drop-after').forEach((el) => {
    el.classList.remove('todo-drop-before', 'todo-drop-after');
  });
  root.querySelectorAll('.todo-list-empty-drop').forEach((el) => {
    el.classList.remove('todo-list-empty-drop');
  });
}

function renderDropIndicator(root: HTMLElement, drop: DropTarget | null, draggingId: string): void {
  clearDropIndicator(root);
  if (!drop) return;
  const list = root.querySelector<HTMLElement>(`[data-column="${drop.column}"] .todo-list`);
  if (!list) return;
  const items = Array.from(list.querySelectorAll<HTMLElement>('.todo-item')).filter(
    (item) => item.dataset.id !== draggingId,
  );
  if (items.length === 0) {
    list.classList.add('todo-list-empty-drop');
    return;
  }
  if (drop.index >= items.length) {
    items[items.length - 1]?.classList.add('todo-drop-after');
  } else {
    items[drop.index]?.classList.add('todo-drop-before');
  }
}

function setupDrag(target: HTMLElement, store: TodoStore): void {
  target.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const item = (event.target as HTMLElement).closest<HTMLElement>('.todo-item');
    if (!item || !target.contains(item)) return;
    const interactive = (event.target as HTMLElement).closest(
      'input, .todo-edit-input, .todo-check, .todo-add',
    );
    if (interactive) return;

    const id = item.dataset.id;
    if (!id) return;
    const startX = event.clientX;
    const startY = event.clientY;

    let activated = false;
    let ghost: HTMLElement | null = null;
    let lastDrop: DropTarget | null = null;

    const activate = (): void => {
      activated = true;
      const rect = item.getBoundingClientRect();
      const clone = item.cloneNode(true) as HTMLElement;
      clone.classList.add('todo-item-ghost');
      clone.style.position = 'fixed';
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.pointerEvents = 'none';
      clone.style.zIndex = '1000';
      document.body.appendChild(clone);
      ghost = clone;
      item.classList.add('todo-item-dragging');
    };

    const onMove = (e: PointerEvent): void => {
      if (!activated) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
        activate();
      }
      if (ghost) {
        ghost.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`;
      }
      lastDrop = computeDrop(e.clientX, e.clientY, target, id);
      renderDropIndicator(target, lastDrop, id);
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (!activated) return;
      ghost?.remove();
      item.classList.remove('todo-item-dragging');
      clearDropIndicator(target);
      if (lastDrop) {
        store.dispatch({
          type: 'move',
          id,
          toColumn: lastDrop.column,
          toIndex: lastDrop.index,
        });
      }
    };

    const onCancel = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      if (!activated) return;
      ghost?.remove();
      item.classList.remove('todo-item-dragging');
      clearDropIndicator(target);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
  });
}
