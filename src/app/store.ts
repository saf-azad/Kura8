import { parseDocument, serialiseDocument, type RatioDoc } from '../core/document';
const KEY = 'kura8:doc';
export function newDocumentId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)), n => 'abcdefghijklmnopqrstuvwxyz0123456789'[n % 36]).join('');
}
export function loadDocument(): RatioDoc | null {
  try {
    const json = localStorage.getItem(KEY);
    if (!json) return null;
    const doc = parseDocument(json);
    return doc.guide !== null ? doc : null;
  } catch { return null; }
}
export function saveDocument(doc: RatioDoc): boolean {
  try { localStorage.setItem(KEY, serialiseDocument(doc)); return true; }
  catch { return false; }
}
