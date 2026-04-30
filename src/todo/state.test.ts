// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_TODO_STATE,
  createTodoStore,
  loadTodoState,
  reduce,
  saveTodoState,
  type TodoState,
} from './state';

function mkItem(overrides: { id: string; text: string; done?: boolean; doneAt?: number | null }) {
  return {
    id: overrides.id,
    text: overrides.text,
    done: overrides.done ?? false,
    createdAt: 0,
    doneAt: overrides.doneAt ?? null,
  };
}

const seed = (): TodoState => ({
  today: [
    mkItem({ id: 'a', text: 'A' }),
    mkItem({ id: 'b', text: 'B' }),
  ],
  tomorrow: [mkItem({ id: 'c', text: 'C' })],
});

describe('todo reducer — add', () => {
  it('appends to the named column', () => {
    const state = reduce(EMPTY_TODO_STATE, {
      type: 'add',
      column: 'today',
      text: 'first',
      id: '1',
      createdAt: 100,
    });
    expect(state.today).toEqual([
      { id: '1', text: 'first', done: false, createdAt: 100, doneAt: null },
    ]);
    expect(state.tomorrow).toEqual([]);
  });

  it('trims text', () => {
    const state = reduce(EMPTY_TODO_STATE, {
      type: 'add',
      column: 'today',
      text: '  hi  ',
      id: '1',
      createdAt: 0,
    });
    expect(state.today[0]?.text).toBe('hi');
  });

  it('ignores empty / whitespace text', () => {
    const state = reduce(EMPTY_TODO_STATE, {
      type: 'add',
      column: 'today',
      text: '   ',
      id: '1',
      createdAt: 0,
    });
    expect(state).toBe(EMPTY_TODO_STATE);
  });
});

describe('todo reducer — edit', () => {
  it('updates text by id, leaves others alone', () => {
    const state = reduce(seed(), { type: 'edit', id: 'b', text: 'B-prime' });
    expect(state.today.map((i) => i.text)).toEqual(['A', 'B-prime']);
  });

  it('ignores unknown id', () => {
    const before = seed();
    const after = reduce(before, { type: 'edit', id: 'zzz', text: 'x' });
    expect(after).toBe(before);
  });

  it('ignores empty text', () => {
    const before = seed();
    const after = reduce(before, { type: 'edit', id: 'a', text: '   ' });
    expect(after).toBe(before);
  });
});

describe('todo reducer — toggleDone', () => {
  it('marks done, stamps doneAt, sorts to bottom of column', () => {
    const state = reduce(seed(), { type: 'toggleDone', id: 'a', now: 500 });
    expect(state.today.map((i) => i.id)).toEqual(['b', 'a']);
    const a = state.today.find((i) => i.id === 'a');
    expect(a?.done).toBe(true);
    expect(a?.doneAt).toBe(500);
  });

  it('un-toggle clears doneAt and floats above done items', () => {
    let state = reduce(seed(), { type: 'toggleDone', id: 'a', now: 500 });
    state = reduce(state, { type: 'toggleDone', id: 'a', now: 999 });
    const a = state.today.find((i) => i.id === 'a');
    expect(a?.done).toBe(false);
    expect(a?.doneAt).toBeNull();
    expect(state.today.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('todo reducer — move + reorder', () => {
  it('moves between columns at target index', () => {
    const state = reduce(seed(), { type: 'move', id: 'a', toColumn: 'tomorrow', toIndex: 0 });
    expect(state.today.map((i) => i.id)).toEqual(['b']);
    expect(state.tomorrow.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('move within same column reorders', () => {
    const state = reduce(seed(), { type: 'move', id: 'a', toColumn: 'today', toIndex: 1 });
    expect(state.today.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('reorder swaps positions', () => {
    const state = reduce(seed(), {
      type: 'reorder',
      column: 'today',
      fromIndex: 0,
      toIndex: 1,
    });
    expect(state.today.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('reorder ignores out-of-range fromIndex', () => {
    const before = seed();
    const after = reduce(before, {
      type: 'reorder',
      column: 'today',
      fromIndex: 9,
      toIndex: 0,
    });
    expect(after).toBe(before);
  });

  it('move clamps an out-of-range toIndex to end of column', () => {
    const state = reduce(seed(), {
      type: 'move',
      id: 'a',
      toColumn: 'tomorrow',
      toIndex: 999,
    });
    expect(state.tomorrow.map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('todo reducer — autoClear', () => {
  it('drops done items older than ttl, keeps recent and active', () => {
    const start: TodoState = {
      today: [
        mkItem({ id: 'old-done', text: 'old', done: true, doneAt: 100 }),
        mkItem({ id: 'fresh-done', text: 'fresh', done: true, doneAt: 900 }),
        mkItem({ id: 'active', text: 'live' }),
      ],
      tomorrow: [],
    };
    const state = reduce(start, { type: 'autoClear', ttlMs: 200, now: 1000 });
    expect(state.today.map((i) => i.id)).toEqual(['fresh-done', 'active']);
  });

  it('returns same reference if nothing is cleared', () => {
    const before = seed();
    const after = reduce(before, { type: 'autoClear', ttlMs: 1000, now: 10_000 });
    expect(after).toBe(before);
  });
});

describe('todo reducer — rollMidnight', () => {
  it('appends tomorrow onto today and empties tomorrow', () => {
    const state = reduce(seed(), { type: 'rollMidnight' });
    expect(state.today.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(state.tomorrow).toEqual([]);
  });

  it('no-op when tomorrow is empty', () => {
    const before: TodoState = { today: [mkItem({ id: 'a', text: 'A' })], tomorrow: [] };
    const after = reduce(before, { type: 'rollMidnight' });
    expect(after).toBe(before);
  });
});

describe('todo store', () => {
  it('emits to subscribers when state changes', () => {
    const store = createTodoStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'add', column: 'today', text: 'x', id: '1', createdAt: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]?.today).toHaveLength(1);
  });

  it('skips emit when reduce returns same reference', () => {
    const store = createTodoStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'edit', id: 'missing', text: 'x' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe stops emitting', () => {
    const store = createTodoStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.dispatch({ type: 'add', column: 'today', text: 'x', id: '1', createdAt: 0 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('todo persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips state through versioned storage', () => {
    const state: TodoState = {
      today: [mkItem({ id: '1', text: 'a' })],
      tomorrow: [mkItem({ id: '2', text: 'b', done: true, doneAt: 5 })],
    };
    saveTodoState(state);
    expect(loadTodoState()).toEqual(state);
  });

  it('returns empty state when nothing persisted', () => {
    expect(loadTodoState()).toEqual(EMPTY_TODO_STATE);
  });

  it('returns empty state when stored shape is invalid', () => {
    localStorage.setItem('todo', JSON.stringify({ version: 1, data: { today: 'oops' } }));
    expect(loadTodoState()).toEqual(EMPTY_TODO_STATE);
  });
});
