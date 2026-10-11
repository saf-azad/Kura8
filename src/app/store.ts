import { migrate, serialiseDocument, type ColourRef, type CompId, type InlineImage, type KuraDoc, type RatioId, type RowId } from '../core/document';
import type { GuideId } from '../core/guides/types';
import { emptyHistory, record, redo, undo, type History } from '../core/history';
import type { Flag } from '../core/reratio';
// One store holds the document and the editor's UI state. Documents are immutable, so a history step is a
// reference. Commits record history and schedule the 500 ms autosave of the one current document.
export type Tool = 'pen' | 'erase' | 'lasso';
export type PanelId = 'shapes' | 'colour' | 'fonts' | 'arrange' | 'layers' | 'grid' | 'ratio' | 'keys' | 'export';
export type DialSettings = { ratio: RatioId; comp: CompId; guide: GuideId; hue: number | null; dark: boolean; accent?: string };
export type UI = {
  screen: 'dial' | 'editor'; size: string; sel: string[]; panel: PanelId | null; tool: Tool | null;
  guides: boolean; grid: { on: boolean; size: number }; help: boolean;
  /** Swatch armed for paint (5e); null when tapping ground deselects. */ armed: ColourRef | null;
  swatch: ColourRef; row: RowId; editing: string | null; flags: Flag[]; removing: string | null; previewDark: boolean | null; ratioMode: 'change' | 'add';
  /** The image whose picture is being dragged inside its frame (D-048). */ reposition: string | null;
};
export type Change = { doc?: boolean; ui?: boolean };
const KEYS = { doc: 'kura8:doc', previous: 'kura8:previous', dial: 'kura8:dial', prefs: 'kura8:prefs', lifted: 'kura8:lifted' };
const read = <T>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const write = (key: string, value: unknown): boolean => { try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true; } catch { return false; } };
export function newDocumentId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), n => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('');
}
let counter = 0;
export const newId = (): string => `n${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** The saved document, migrated from version 1 when needed; inline v1 images are returned for the asset store. */
export function loadDocument(): { doc: KuraDoc; inline: InlineImage[] } | null {
  try { const json = localStorage.getItem(KEYS.doc); return json ? migrate(JSON.parse(json)) : null; } catch { return null; }
}
/** The design New replaced (D-057): kept so Undo can bring it back after a reload. */
export function loadPrevious(): KuraDoc | null {
  try { const json = localStorage.getItem(KEYS.previous); return json ? migrate(JSON.parse(json)).doc : null; } catch { return null; }
}
export function keepPrevious(doc: KuraDoc | null): void { if (doc) write(KEYS.previous, serialiseDocument(doc)); else { try { localStorage.removeItem(KEYS.previous); } catch { /* ignore */ } } }
export const DOC_KEY = KEYS.doc;
export const defaultDial = (): DialSettings => ({ ratio: 'portrait', comp: 'cover', guide: 'golden', hue: 210, dark: false });
export class Store {
  doc: KuraDoc | null;
  ui: UI;
  dial: DialSettings;
  history: History<KuraDoc> = emptyHistory();
  /** Autosave waits while a tween runs. */ paused = false;
  /** Never overwrite the saved document (a v1 migration whose images could not be stored). */ keepSaved = false;
  private listeners = new Set<(c: Change) => void>();
  private saveTimer = 0;
  private warned = false;
  constructor(doc: KuraDoc | null) {
    this.doc = doc;
    this.dial = { ...defaultDial(), ...read<DialSettings>(KEYS.dial) };
    const prefs = read<Partial<UI>>(KEYS.prefs) ?? {};
    this.ui = { screen: doc ? 'editor' : 'dial', size: doc?.sizes.some(s => s.id === prefs.size) ? prefs.size! : doc?.sizes[0].id ?? 'main', sel: [], panel: null, tool: null, guides: prefs.guides ?? true, grid: prefs.grid ?? { on: false, size: 40 }, help: false,
      armed: null, swatch: { role: 'accent' }, row: 'accent', editing: null, flags: [], removing: null, previewDark: null, ratioMode: 'change', reposition: null };
  }
  on(fn: (c: Change) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(c: Change): void { for (const fn of this.listeners) fn(c); }
  /** Live update without a history step (drags, typing); finish with commit({ before }). */
  set(doc: KuraDoc): void { this.doc = doc; this.emit({ doc: true }); }
  commit(doc: KuraDoc, o: { key?: string; before?: KuraDoc | null; keepFlags?: boolean } = {}): void {
    const before = o.before === undefined ? this.doc : o.before;
    if (before && before !== doc) this.history = record(this.history, before, { now: performance.now(), key: o.key });
    this.doc = doc;
    const ids = new Set(doc.nodes.map(n => n.id)), sel = this.ui.sel.filter(id => ids.has(id));
    this.ui = { ...this.ui, sel, flags: o.keepFlags ? this.ui.flags : this.ui.flags.filter(f => ids.has(f.id)), size: doc.sizes.some(s => s.id === this.ui.size) ? this.ui.size : doc.sizes[0].id };
    this.scheduleSave(); this.emit({ doc: true, ui: true });
  }
  undo(): boolean { return this.step(undo); }
  redo(): boolean { return this.step(redo); }
  private step(fn: typeof undo): boolean {
    if (!this.doc) return false;
    const r = fn(this.history, this.doc);
    if (!r) return false;
    this.history = r.history; this.doc = r.value;
    const ids = new Set(r.value.nodes.map(n => n.id));
    this.ui = { ...this.ui, sel: this.ui.sel.filter(id => ids.has(id)), editing: null, flags: [], size: r.value.sizes.some(s => s.id === this.ui.size) ? this.ui.size : r.value.sizes[0].id };
    this.scheduleSave(); this.emit({ doc: true, ui: true });
    return true;
  }
  setUI(patch: Partial<UI>): void {
    this.ui = { ...this.ui, ...patch };
    // The active size outlives a reload too (D-081).
    if ('guides' in patch || 'grid' in patch || 'size' in patch) write(KEYS.prefs, { guides: this.ui.guides, grid: this.ui.grid, size: this.ui.size });
    this.emit({ ui: true });
  }
  setDial(patch: Partial<DialSettings>): void { this.dial = { ...this.dial, ...patch }; if (!('accent' in patch) && 'hue' in patch) delete this.dial.accent; write(KEYS.dial, this.dial); this.emit({ ui: true }); }
  scheduleSave(): void { clearTimeout(this.saveTimer); this.saveTimer = window.setTimeout(() => this.save(), 500); }
  /** Returns false when the browser refused the write (quota, private mode). */
  save(onError?: () => void): boolean {
    if (!this.doc) return true;
    if (this.keepSaved) return false;
    if (this.paused) { this.scheduleSave(); return true; }
    let json: string;
    try { json = serialiseDocument(this.doc); } catch (e) { console.warn('Not saved: invalid document', e); return false; }
    const ok = write(KEYS.doc, json);
    if (!ok && !this.warned) { this.warned = true; onError?.(); this.emit({ ui: true }); }
    if (ok) this.warned = false;
    return ok;
  }
  get saveFailed(): boolean { return this.warned; }
  static lifted(): boolean { return read<boolean>(KEYS.lifted) === true; }
  static markLifted(): void { write(KEYS.lifted, true); }
}
