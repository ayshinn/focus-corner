// Top-bar slot that displays the current task. Step 19 wires this to the
// todo store. For now the slot just defaults to its empty state.

let targetEl: HTMLElement | null = null;

export function mountCurrentTask(el: HTMLElement): void {
  targetEl = el;
  setCurrentTask(null);
}

export function setCurrentTask(text: string | null): void {
  if (!targetEl) return;
  if (text == null || text.trim() === '') {
    targetEl.textContent = 'No task';
    targetEl.setAttribute('data-empty', 'true');
  } else {
    targetEl.textContent = text;
    targetEl.setAttribute('data-empty', 'false');
  }
}
