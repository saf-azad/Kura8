import { parseDocument, serialiseDocument, type RatioDoc } from '../core/document';
export type Mode = 'guide' | 'blank';
export function loadDocument(id: string, mode: Mode): RatioDoc | null {
  try {
    const json = localStorage.getItem(`ratio:${id}:${mode}`);
    if (!json) return null;
    const doc = parseDocument(json);
    return doc.id === id && (mode === 'blank' ? doc.guide === null && doc.ratio === 'square' : doc.guide !== null) ? doc : null;
  } catch { return null; }
}
export function saveDocument(doc: RatioDoc, mode: Mode): boolean {
  try { localStorage.setItem(`ratio:${doc.id}:${mode}`, serialiseDocument(doc)); return true; }
  catch { return false; }
}
