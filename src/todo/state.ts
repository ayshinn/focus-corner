// Todo reducer + store. Pure logic + a thin store wrapper that handles
// listener fan-out and (optionally) localStorage persistence via the
// versioned helper. UI work lives in `index.ts`.
//
// Items live in two columns — Today and Tomorrow. The reducer never
// touches the clock; callers pass `now` / `createdAt` so tests stay
// deterministic.

import { read, write, type MigrationMap } from '../storage/versioned';

export type ColumnId = 'today' | 'tomorrow';

export const COLUMNS: readonly ColumnId[] = ['today', 'tomorrow'];

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  doneAt: number | null;
}

export interface TodoState {
  today: TodoItem[];
  tomorrow: TodoItem[];
}

export const EMPTY_TODO_STATE: TodoState = { today: [], tomorrow: [] };

export type TodoAction =
  | { type: 'add'; column: ColumnId; text: string; id: string; createdAt: number }
  | { type: 'edit'; id: string; text: string }
  | { type: 'toggleDone'; id: string; now: number }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; toColumn: ColumnId; toIndex: number }
  | { type: 'reorder'; column: ColumnId; fromIndex: number; toIndex: number }
  | { type: 'autoClear'; ttlMs: number; now: number }
  | { type: 'rollMidnight' };

interface Located {
  column: ColumnId;
  index: number;
  item: TodoItem;
}

function locate(state: TodoState, id: string): Located | null {
  for (const column of COLUMNS) {
    const items = state[column];
    const index = items.findIndex((i) => i.id === id);
    if (index !== -1) {
      const item = items[index];
      if (item) return { column, index, item };
    }
  }
  return null;
}

function clampIndex(target: number, length: number): number {
  if (!Number.isFinite(target) || target < 0) return 0;
  if (target > length) return length;
  return Math.floor(target);
}

function sortDoneToBottom(items: TodoItem[]): TodoItem[] {
  const active: TodoItem[] = [];
  const done: TodoItem[] = [];
  for (const item of items) {
    if (item.done) done.push(item);
    else active.push(item);
  }
  return [...active, ...done];
}

export function reduce(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'add': {
      const text = action.text.trim();
      if (text === '') return state;
      const item: TodoItem = {
        id: action.id,
        text,
        done: false,
        createdAt: action.createdAt,
        doneAt: null,
      };
      return { ...state, [action.column]: [...state[action.column], item] };
    }
    case 'edit': {
      const text = action.text.trim();
      if (text === '') return state;
      const located = locate(state, action.id);
      if (!located) return state;
      const next = [...state[located.column]];
      next[located.index] = { ...located.item, text };
      return { ...state, [located.column]: next };
    }
    case 'toggleDone': {
      const located = locate(state, action.id);
      if (!located) return state;
      const done = !located.item.done;
      const next = [...state[located.column]];
      next[located.index] = {
        ...located.item,
        done,
        doneAt: done ? action.now : null,
      };
      return { ...state, [located.column]: sortDoneToBottom(next) };
    }
    case 'remove': {
      const located = locate(state, action.id);
      if (!located) return state;
      const next = [...state[located.column]];
      next.splice(located.index, 1);
      return { ...state, [located.column]: next };
    }
    case 'move': {
      const located = locate(state, action.id);
      if (!located) return state;
      if (located.column === action.toColumn) {
        const items = [...state[located.column]];
        items.splice(located.index, 1);
        const target = clampIndex(action.toIndex, items.length);
        items.splice(target, 0, located.item);
        return { ...state, [located.column]: items };
      }
      const fromItems = [...state[located.column]];
      fromItems.splice(located.index, 1);
      const toItems = [...state[action.toColumn]];
      const target = clampIndex(action.toIndex, toItems.length);
      toItems.splice(target, 0, located.item);
      return {
        ...state,
        [located.column]: fromItems,
        [action.toColumn]: toItems,
      };
    }
    case 'reorder': {
      const items = [...state[action.column]];
      if (action.fromIndex < 0 || action.fromIndex >= items.length) return state;
      const [removed] = items.splice(action.fromIndex, 1);
      if (!removed) return state;
      const target = clampIndex(action.toIndex, items.length);
      items.splice(target, 0, removed);
      return { ...state, [action.column]: items };
    }
    case 'autoClear': {
      const cutoff = action.now - action.ttlMs;
      const filter = (items: TodoItem[]): TodoItem[] =>
        items.filter((i) => !(i.done && i.doneAt !== null && i.doneAt < cutoff));
      const today = filter(state.today);
      const tomorrow = filter(state.tomorrow);
      if (today.length === state.today.length && tomorrow.length === state.tomorrow.length) {
        return state;
      }
      return { today, tomorrow };
    }
    case 'rollMidnight': {
      if (state.tomorrow.length === 0) return state;
      return {
        today: [...state.today, ...state.tomorrow],
        tomorrow: [],
      };
    }
  }
}

// ----- Store -----

export interface TodoStore {
  getState(): TodoState;
  dispatch(action: TodoAction): TodoState;
  subscribe(fn: (state: TodoState) => void): () => void;
}

export interface TodoStoreOptions {
  initial?: TodoState;
  onChange?: (state: TodoState) => void;
}

export function createTodoStore(options: TodoStoreOptions = {}): TodoStore {
  let state: TodoState = options.initial ?? EMPTY_TODO_STATE;
  const listeners = new Set<(state: TodoState) => void>();

  function emit(): void {
    options.onChange?.(state);
    for (const fn of listeners) fn(state);
  }

  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next !== state) {
        state = next;
        emit();
      }
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// ----- Persistence -----

const STORAGE_KEY = 'todo';
const STORAGE_VERSION = 1;
const MIGRATIONS: MigrationMap = {};

function isItem(value: unknown): value is TodoItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.text === 'string' &&
    typeof v.done === 'boolean' &&
    typeof v.createdAt === 'number' &&
    (v.doneAt === null || typeof v.doneAt === 'number')
  );
}

function isState(value: unknown): value is TodoState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.today) &&
    Array.isArray(v.tomorrow) &&
    v.today.every(isItem) &&
    v.tomorrow.every(isItem)
  );
}

export function loadTodoState(): TodoState {
  const stored = read<unknown>(STORAGE_KEY, STORAGE_VERSION, MIGRATIONS);
  if (stored && isState(stored)) return stored;
  return EMPTY_TODO_STATE;
}

export function saveTodoState(state: TodoState): void {
  write(STORAGE_KEY, STORAGE_VERSION, state);
}
