import type { Editor } from '../editor';
// Keyboard map (AGENTS → Keyboard controls). Mod is Command on Mac and Ctrl elsewhere. Shortcuts never intercept
// typing controls, IME composition or native modifier combinations they do not own.
export function isMac(platform: string): boolean { return /Mac|iPhone|iPad|iPod/i.test(platform); }
export function primaryModifier(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey'>, mac: boolean): boolean {
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
export function shortcutLabel(keys: string, mac: boolean): string {
  return keys.replace('Mod', mac ? '⌘' : 'Ctrl').replace('Shift', mac ? '⇧' : 'Shift');
}
/** Controls that take typing; sliders, switches and buttons do not, so shortcuts and Escape still work after using them. */
export function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement && ['range', 'checkbox', 'radio', 'button', 'color', 'submit', 'reset'].includes(target.type)) return false;
  return !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
/** Arrow step (5l): one unit; with Shift one grid cell when the grid is on, otherwise ten units. */
export const nudgeStep = (shift: boolean, grid: { on: boolean; size: number }): number => shift ? (grid.on ? grid.size : 10) : 1;
export type Command = 'copy' | 'cut' | 'duplicate' | 'selectAll' | 'undo' | 'redo' | 'forward' | 'backward' | 'front' | 'back' | 'lock' | 'bold' | 'export';
/** The letter a key event names: the typed Latin letter, else (an Arabic, Cyrillic or Korean layout) the key's place on a Latin keyboard (D-077). */
export const letterOf = (e: Pick<KeyboardEvent, 'key' | 'code'>): string => /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
/** The Mod-combination a key event means, or null when Kura8 does not own it. */
export function modCommand(e: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey'>): Command | null {
  if (e.altKey) return null;
  if (e.code === 'BracketRight') return e.shiftKey ? 'front' : 'forward';
  if (e.code === 'BracketLeft') return e.shiftKey ? 'back' : 'backward';
  const k = letterOf(e);
  if (e.shiftKey) return k === 'z' ? 'redo' : k === 'l' ? 'lock' : k === 'e' ? 'export' : null;
  return ({ c: 'copy', x: 'cut', d: 'duplicate', a: 'selectAll', z: 'undo', y: 'redo', b: 'bold' } as Record<string, Command>)[k] ?? null;
}
export function installShortcuts(ed: Editor): void {
  const mac = isMac(navigator.platform);
  document.addEventListener('keydown', e => {
    const ui = ed.store.ui;
    if (ui.screen !== 'editor' || !ed.store.doc || e.isComposing || isEditingTarget(e.target)) return;
    if (ui.panel === 'export') { if (e.key === 'Escape') { e.preventDefault(); ed.openPanel(null); } return; }
    if (ui.panel === 'keys' && (e.key === 'Escape' || e.key === '?' || e.key === '؟')) { e.preventDefault(); ed.openPanel(null); return; }
    if (primaryModifier(e, mac)) {
      const command = modCommand(e);
      if (!command) return;
      // Copy and cut also let the browser's copy event fire, which writes the text to the system clipboard.
      if (command === 'copy' || command === 'cut') { if (!e.repeat) { if (command === 'copy') ed.copy(); else ed.cut(); } return; }
      e.preventDefault();
      if (e.repeat && command !== 'undo' && command !== 'redo') return;
      ({ duplicate: () => ed.duplicate(), selectAll: () => ed.selectAll(), undo: () => ed.undo(), redo: () => ed.redo(),
        forward: () => ed.reorder('forward'), backward: () => ed.reorder('backward'), front: () => ed.reorder('front'), back: () => ed.reorder('back'),
        lock: () => ed.toggleLock(), bold: () => ed.toggleBold(), export: () => ed.openPanel('export') })[command]();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    // While repositioning, arrows move the picture inside its frame instead of the frame.
    if (arrows[e.key] && ui.reposition) { e.preventDefault(); const s = nudgeStep(e.shiftKey, ui.grid); ed.nudgePicture(ui.reposition, arrows[e.key][0] * s, arrows[e.key][1] * s); return; }
    if (arrows[e.key]) { if (!ui.sel.length) return; e.preventDefault(); const s = nudgeStep(e.shiftKey, ui.grid); ed.nudge(arrows[e.key][0] * s, arrows[e.key][1] * s); return; }
    if (ui.reposition && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); ed.finishReposition(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ui.armed) ed.store.setUI({ armed: null });
      else if (ui.panel) ed.openPanel(null);
      else if (ui.tool) ed.setTool(null);
      else ed.select([]);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ed.remove(); return; }
    if (e.key === 'Enter') { const one = ed.one(); if (one?.kind === 'text' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); ed.editText(one.id); } return; }
    if (e.key === '?' || e.key === '؟') { e.preventDefault(); ed.openPanel('keys'); return; }
    if (e.repeat) return;
    const run = ({ t: () => ed.addText(), r: () => ed.addShape('rect'), o: () => ed.addShape('circle'), s: () => ed.openPanel('shapes'), i: () => ed.imageTool(),
      p: () => ed.setTool(ui.tool === 'pen' ? null : 'pen'), e: () => ed.setTool('erase'), l: () => ed.setTool('lasso'), c: () => ed.openPanel('colour'), g: () => ed.setGuides(!ui.guides) } as Record<string, () => void>)[letterOf(e)];
    if (run) { e.preventDefault(); run(); }
  });
  // Copy and cut write the copied text (or layer names) to the system clipboard, so text can go to other apps and a
  // later paste can tell Kura8's own copy from text copied elsewhere.
  const write = (e: ClipboardEvent) => {
    if (ed.store.ui.screen !== 'editor' || isEditingTarget(e.target) || !ed.clip.length || !e.clipboardData) return;
    e.preventDefault(); ed.clipText = ed.clipboardText(); e.clipboardData.setData('text/plain', ed.clipText);
  };
  document.addEventListener('copy', write); document.addEventListener('cut', write);
  // Paste: images from the system clipboard go to the nearest cell; text copied in another app becomes a text block;
  // otherwise Kura8's own clipboard.
  document.addEventListener('paste', e => {
    if (ed.store.ui.screen !== 'editor' || isEditingTarget(e.target)) return;
    const files = [...e.clipboardData?.files ?? []].filter(f => f.type.startsWith('image/')), text = e.clipboardData?.getData('text/plain') ?? '';
    e.preventDefault();
    if (files.length) void ed.placeFiles(files, null);
    else if (text.trim() && (!ed.clip.length || ed.clipText !== null && text !== ed.clipText)) ed.addPastedText(text);
    else ed.paste();
  });
}
