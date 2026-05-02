// Sticky notes overlay. Free-positioned, draggable, IDB-persisted notes
// that float above the backdrop. Markdown-lite via `marked` with an
// edit/preview toggle per spec §6.4.
//
// Layout: each note is absolutely positioned within the stage. Drag is
// owned here (Pointer Events) instead of going through the existing
// todo drag system because notes need free 2D translation, not list
// reordering.

import { marked } from 'marked';
import { deleteNote, listNotes, putNote, type StickyNote } from './store';

const NOTE_DEFAULT_WIDTH = 200;
const NOTE_DEFAULT_HEIGHT = 160;
const NOTE_MIN_WIDTH = 140;
const NOTE_MIN_HEIGHT = 100;

marked.setOptions({ breaks: true, gfm: true });

function nowId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function clampToStage(x: number, y: number, w: number, h: number, stage: HTMLElement): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(rect.width - w, x)),
    y: Math.max(0, Math.min(rect.height - h, y)),
  };
}

interface MountedNote {
  el: HTMLElement;
  note: StickyNote;
  // True while the textarea is showing rather than the rendered preview.
  editing: boolean;
}

export function mountStickyNotes(stage: HTMLElement): void {
  const layer = document.createElement('div');
  layer.className = 'sticky-layer';
  stage.appendChild(layer);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'sticky-add';
  fab.textContent = '+ Note';
  fab.setAttribute('aria-label', 'Add sticky note');
  layer.appendChild(fab);

  const mounted = new Map<string, MountedNote>();

  function persist(note: StickyNote): void {
    note.updatedAt = Date.now();
    void putNote(note);
  }

  function setView(mn: MountedNote): void {
    const body = mn.el.querySelector<HTMLElement>('[data-slot="body"]')!;
    const textarea = mn.el.querySelector<HTMLTextAreaElement>('[data-slot="editor"]')!;
    const toggleBtn = mn.el.querySelector<HTMLButtonElement>('[data-action="toggle-edit"]')!;
    if (mn.editing) {
      body.hidden = true;
      textarea.hidden = false;
      textarea.value = mn.note.text;
      textarea.focus();
      toggleBtn.textContent = '👁';
      toggleBtn.title = 'Preview';
    } else {
      const html = marked.parse(mn.note.text || '_(empty)_', { async: false });
      body.innerHTML = typeof html === 'string' ? html : '';
      body.hidden = false;
      textarea.hidden = true;
      toggleBtn.textContent = '✎';
      toggleBtn.title = 'Edit';
    }
  }

  function attachDrag(mn: MountedNote): void {
    const handle = mn.el.querySelector<HTMLElement>('[data-slot="handle"]')!;
    let pointerId: number | null = null;
    let offsetX = 0;
    let offsetY = 0;
    handle.addEventListener('pointerdown', (event) => {
      // Don't initiate drag from header buttons.
      if ((event.target as HTMLElement).closest('button')) return;
      pointerId = event.pointerId;
      handle.setPointerCapture(event.pointerId);
      const rect = mn.el.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      mn.el.classList.add('sticky-dragging');
    });
    handle.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return;
      const stageRect = stage.getBoundingClientRect();
      const x = event.clientX - stageRect.left - offsetX;
      const y = event.clientY - stageRect.top - offsetY;
      const clamped = clampToStage(x, y, mn.note.width, mn.note.height, stage);
      mn.note.x = clamped.x;
      mn.note.y = clamped.y;
      mn.el.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`;
    });
    const end = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      handle.releasePointerCapture(event.pointerId);
      mn.el.classList.remove('sticky-dragging');
      persist(mn.note);
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function renderNote(note: StickyNote): MountedNote {
    const el = document.createElement('article');
    el.className = 'sticky-note';
    el.style.width = `${note.width}px`;
    el.style.height = `${note.height}px`;
    el.style.transform = `translate(${note.x}px, ${note.y}px)`;
    el.dataset.id = note.id;
    el.innerHTML = `
      <header class="sticky-header" data-slot="handle">
        <button type="button" class="sticky-icon-btn" data-action="toggle-edit" aria-label="Toggle edit">✎</button>
        <span class="sticky-spacer"></span>
        <button type="button" class="sticky-icon-btn sticky-delete" data-action="delete" aria-label="Delete">×</button>
      </header>
      <div class="sticky-body" data-slot="body"></div>
      <textarea class="sticky-editor" data-slot="editor" hidden aria-label="Note text"></textarea>
    `;
    layer.appendChild(el);
    const mn: MountedNote = { el, note, editing: false };

    el.querySelector<HTMLButtonElement>('[data-action="toggle-edit"]')?.addEventListener('click', () => {
      mn.editing = !mn.editing;
      setView(mn);
    });
    el.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', () => {
      mn.el.remove();
      mounted.delete(note.id);
      void deleteNote(note.id);
    });
    const textarea = el.querySelector<HTMLTextAreaElement>('[data-slot="editor"]')!;
    textarea.addEventListener('input', () => {
      mn.note.text = textarea.value;
      // Defer persist on every keystroke; small debounce.
      if (saveTimers.get(note.id)) window.clearTimeout(saveTimers.get(note.id));
      saveTimers.set(
        note.id,
        window.setTimeout(() => persist(mn.note), 400),
      );
    });
    textarea.addEventListener('blur', () => {
      mn.editing = false;
      setView(mn);
      persist(mn.note);
    });

    setView(mn);
    attachDrag(mn);
    mounted.set(note.id, mn);
    return mn;
  }

  const saveTimers = new Map<string, number>();

  fab.addEventListener('click', () => {
    const stageRect = stage.getBoundingClientRect();
    const x = Math.max(40, stageRect.width / 2 - NOTE_DEFAULT_WIDTH / 2);
    const y = Math.max(40, stageRect.height / 2 - NOTE_DEFAULT_HEIGHT / 2);
    const note: StickyNote = {
      id: nowId(),
      text: '',
      x,
      y,
      width: NOTE_DEFAULT_WIDTH,
      height: NOTE_DEFAULT_HEIGHT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    void putNote(note);
    const mn = renderNote(note);
    mn.editing = true;
    setView(mn);
  });

  void listNotes().then((notes) => {
    for (const note of notes) {
      // Coerce missing dimensions onto the defaults so older records
      // upgrade transparently if the schema ever loosens.
      if (!note.width) note.width = NOTE_DEFAULT_WIDTH;
      if (!note.height) note.height = NOTE_DEFAULT_HEIGHT;
      if (note.width < NOTE_MIN_WIDTH) note.width = NOTE_MIN_WIDTH;
      if (note.height < NOTE_MIN_HEIGHT) note.height = NOTE_MIN_HEIGHT;
      renderNote(note);
    }
  });
}
