// @vitest-environment jsdom

// Integration tests: exercise mounted modules against a jsdom DOM rather
// than the pure-logic surfaces. Step 39 graduates DOM testing from
// "later" to "now". We intentionally avoid Playwright / Vitest browser
// mode — jsdom covers the headline assertions (pomodoro tick, todo CRUD,
// theme attribute, hotkeys + cheatsheet) without binary deps.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, bootstrapTheme, registerTheme } from '../theme';
import { minimal } from '../theme/themes/minimal';
import { mountPomodoro } from '../pomodoro';
import { mountTodo } from '../todo';
import { mountCurrentTask } from '../current-task';
import {
  installCheatsheetHotkeys,
  registerHotkey,
  type HotkeyDefinition,
} from '../hotkeys';
import { _resetHotkeys } from '../hotkeys/registry';

function resetDom(): void {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-variant');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDom();
  _resetHotkeys();
});

afterEach(() => {
  _resetHotkeys();
});

describe('theme switch', () => {
  it('applyTheme writes data-theme + data-variant + token vars', () => {
    registerTheme(minimal);
    bootstrapTheme();
    applyTheme('minimal', 'night');
    expect(document.documentElement.getAttribute('data-theme')).toBe('minimal');
    expect(document.documentElement.getAttribute('data-variant')).toBe('night');
    expect(document.documentElement.style.getPropertyValue('--accent').length).toBeGreaterThan(0);
  });
});

describe('pomodoro mount', () => {
  it('renders idle state and updates the tab title once started', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const store = mountPomodoro(slot);
    expect(slot.querySelector('[data-slot="phase"]')?.textContent).toBe('Idle');
    const startBtn = slot.querySelector<HTMLButtonElement>('[data-action="start"]');
    expect(startBtn?.textContent).toBe('Start');
    startBtn?.click();
    // After start the FSM enters work; tab title contains the work label.
    expect(store.getState().phase).toBe('work');
    expect(document.title.toLowerCase()).toContain('work');
  });

  it('tick advances the countdown and onIntervalEnd fires at zero', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const store = mountPomodoro(slot);
    store.start();
    const before = store.getState().remainingMs;
    store.tick(1000);
    expect(store.getState().remainingMs).toBe(before - 1000);
    // Drain the interval; the FSM lands at remainingMs=0 with running=false.
    store.tick(before);
    expect(store.getState().remainingMs).toBe(0);
    expect(store.getState().running).toBe(false);
  });
});

describe('todo flow', () => {
  it('adds, completes, and reflects to the current task slot', () => {
    const todoSlot = document.createElement('div');
    const currentSlot = document.createElement('div');
    document.body.appendChild(todoSlot);
    document.body.appendChild(currentSlot);
    mountCurrentTask(currentSlot);
    mountTodo(todoSlot);

    const form = todoSlot.querySelector<HTMLFormElement>('[data-add="today"]')!;
    const input = form.querySelector<HTMLInputElement>('input[name="text"]')!;
    input.value = 'Write integration tests';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const todayList = todoSlot.querySelector<HTMLElement>('[data-column="today"] .todo-list')!;
    expect(todayList.children.length).toBe(1);
    expect(currentSlot.textContent).toContain('Write integration tests');

    const checkbox = todayList.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.click();
    const item = todayList.querySelector<HTMLElement>('.todo-item')!;
    expect(item.dataset.done).toBe('true');
  });
});

describe('hotkeys + cheatsheet', () => {
  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  it('? opens the cheatsheet, Escape closes it, and registered shortcuts appear', () => {
    installCheatsheetHotkeys();
    const fakeHandler = (): void => {};
    const def: HotkeyDefinition = {
      key: 't',
      description: 'Run a fake action',
      section: 'Test',
      handler: fakeHandler,
    };
    registerHotkey(def);

    press('?');
    const modal = document.querySelector<HTMLElement>('.cheatsheet')!;
    expect(modal.hidden).toBe(false);
    expect(modal.textContent).toContain('Run a fake action');

    press('Escape');
    expect(modal.hidden).toBe(true);
  });

  it('input focus suppresses hotkey dispatch', () => {
    let count = 0;
    registerHotkey({
      key: 'g',
      description: 'count',
      section: 'Test',
      handler: () => {
        count += 1;
      },
    });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    expect(count).toBe(0);
    // Window-level (no input focused) does fire.
    input.blur();
    press('g');
    expect(count).toBe(1);
  });
});
