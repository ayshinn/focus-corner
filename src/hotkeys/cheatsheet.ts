// "?" cheatsheet modal. Lists every binding currently registered, grouped
// by section. The registry's "?" binding opens it; "Escape" closes it.
//
// We render once on first open and keep the modal in the DOM so reopen
// is instantaneous. The list re-renders any time the registry changes.

import { listHotkeys, registerHotkey, subscribeHotkeys } from './registry';

let modalEl: HTMLElement | null = null;
let isOpen = false;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function keyLabel(key: string): string {
  if (key === ' ') return 'Space';
  return key;
}

function ensureModal(): HTMLElement {
  if (modalEl) return modalEl;
  const el = document.createElement('div');
  el.className = 'cheatsheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Keyboard shortcuts');
  el.innerHTML = `
    <div class="cheatsheet-backdrop" data-action="close"></div>
    <div class="cheatsheet-panel" role="document">
      <header class="cheatsheet-header">
        <h2>Keyboard shortcuts</h2>
        <button type="button" class="cheatsheet-close" data-action="close" aria-label="Close">×</button>
      </header>
      <div class="cheatsheet-body" data-slot="body"></div>
    </div>
  `;
  el.hidden = true;
  el.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action="close"]');
    if (action) close();
  });
  document.body.appendChild(el);
  modalEl = el;
  subscribeHotkeys(() => {
    if (isOpen) renderBody();
  });
  return el;
}

function renderBody(): void {
  if (!modalEl) return;
  const body = modalEl.querySelector<HTMLElement>('[data-slot="body"]')!;
  const grouped = new Map<string, ReturnType<typeof listHotkeys>>();
  for (const hk of listHotkeys()) {
    const arr = grouped.get(hk.section) ?? [];
    arr.push(hk);
    grouped.set(hk.section, arr);
  }
  if (grouped.size === 0) {
    body.innerHTML = `<div class="cheatsheet-empty">No shortcuts registered.</div>`;
    return;
  }
  body.innerHTML = Array.from(grouped.entries())
    .map(
      ([section, hotkeys]) => `
      <section class="cheatsheet-section">
        <h3>${escapeHtml(section)}</h3>
        <ul>
          ${hotkeys
            .map(
              (h) =>
                `<li><kbd>${escapeHtml(keyLabel(h.key))}</kbd><span>${escapeHtml(h.description)}</span></li>`,
            )
            .join('')}
        </ul>
      </section>`,
    )
    .join('');
}

export function openCheatsheet(): void {
  ensureModal();
  if (!modalEl) return;
  isOpen = true;
  modalEl.hidden = false;
  renderBody();
}

export function close(): void {
  if (!modalEl) return;
  isOpen = false;
  modalEl.hidden = true;
}

export function toggleCheatsheet(): void {
  if (isOpen) close();
  else openCheatsheet();
}

export function installCheatsheetHotkeys(): void {
  registerHotkey({
    key: '?',
    description: 'Show keyboard shortcuts',
    section: 'General',
    handler: () => toggleCheatsheet(),
  });
  // Escape closes when open. Doesn't preventDefault when nothing is
  // open so it remains available to widgets that listen for Escape.
  registerHotkey({
    key: 'Escape',
    description: 'Close cheatsheet',
    section: 'General',
    handler: () => {
      if (isOpen) close();
    },
    preventDefault: false,
  });
}
