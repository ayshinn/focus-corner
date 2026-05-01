// Centralized hotkey registry. Step 31 introduced a tiny per-feature
// suppressor; this is the upgrade — every feature registers its
// shortcuts here so the cheatsheet can render the canonical list.
//
// Bindings are keyed by the canonical event.key. We deliberately do
// NOT support modifier combos yet — the spec only lists single-key
// shortcuts and a generic registry would invite scope creep.

export interface HotkeyDefinition {
  // The event.key value to match (e.g. ' ', '[', '=', '?'). Case-
  // sensitive only for letter keys; numbers/punctuation already have a
  // canonical form.
  key: string;
  description: string;
  section: string;
  handler: (event: KeyboardEvent) => void;
  // When true (default), the registry calls preventDefault. Set false
  // for shortcuts that should let the browser also handle them.
  preventDefault?: boolean;
}

const bindings = new Map<string, HotkeyDefinition>();
const listeners = new Set<() => void>();
let installed = false;

function notify(): void {
  for (const fn of listeners) fn();
}

function targetIsEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (targetIsEditable(event.target)) return;
  const binding = bindings.get(event.key);
  if (!binding) return;
  if (binding.preventDefault !== false) event.preventDefault();
  binding.handler(event);
}

function ensureInstalled(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', onKeyDown);
}

export function registerHotkey(definition: HotkeyDefinition): () => void {
  ensureInstalled();
  bindings.set(definition.key, definition);
  notify();
  return () => {
    if (bindings.get(definition.key) === definition) {
      bindings.delete(definition.key);
      notify();
    }
  };
}

export function listHotkeys(): HotkeyDefinition[] {
  return Array.from(bindings.values()).sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.key.localeCompare(b.key);
  });
}

export function subscribeHotkeys(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Test-only escape hatch so unit tests can reset state between cases.
export function _resetHotkeys(): void {
  bindings.clear();
  listeners.clear();
  if (installed) {
    window.removeEventListener('keydown', onKeyDown);
    installed = false;
  }
}
