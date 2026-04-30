// Floating todo card. Two columns (Today / Tomorrow) over the backdrop.
// Persists every change through the versioned store. The top-bar Current
// Task slot reads the first non-done item of Today live.

import { setCurrentTask } from '../current-task';
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

  return store;
}
