// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetHotkeys, listHotkeys, registerHotkey } from './registry';

afterEach(() => _resetHotkeys());

function press(key: string, opts: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  window.dispatchEvent(event);
  return event;
}

describe('hotkey registry', () => {
  it('registers and dispatches by key', () => {
    const handler = vi.fn();
    registerHotkey({ key: 'a', description: 'test a', section: 'Test', handler });
    press('a');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('disposer removes the binding', () => {
    const handler = vi.fn();
    const dispose = registerHotkey({ key: 'b', description: 'test b', section: 'Test', handler });
    dispose();
    press('b');
    expect(handler).not.toHaveBeenCalled();
  });

  it('suppresses when target is an input', () => {
    const handler = vi.fn();
    registerHotkey({ key: 'c', description: 'test c', section: 'Test', handler });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });

  it('suppresses when modifier keys are held', () => {
    const handler = vi.fn();
    registerHotkey({ key: 'd', description: 'test d', section: 'Test', handler });
    press('d', { metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('preventDefault is on by default', () => {
    registerHotkey({ key: 'e', description: 'test e', section: 'Test', handler: () => {} });
    const event = press('e');
    expect(event.defaultPrevented).toBe(true);
  });

  it('preventDefault: false lets the browser pass through', () => {
    registerHotkey({
      key: 'f',
      description: 'test f',
      section: 'Test',
      handler: () => {},
      preventDefault: false,
    });
    const event = press('f');
    expect(event.defaultPrevented).toBe(false);
  });

  it('listHotkeys sorts by section then key', () => {
    registerHotkey({ key: 'z', description: 'z', section: 'B', handler: () => {} });
    registerHotkey({ key: 'a', description: 'a', section: 'A', handler: () => {} });
    const ordered = listHotkeys().map((h) => h.key);
    expect(ordered).toEqual(['a', 'z']);
  });
});
