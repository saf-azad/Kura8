import type { Measure } from '../src/core/geometry';
import { createDocument, type DocNode, type Frame, type KuraDoc, type SizeSpec } from '../src/core/document';
/** Fixed-width fake measurer: every character is 0.6 em wide; words wrap greedily, paragraphs break on \n. */
export const fakeMeasure: Measure = (text, size, _weight, width) => {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) { const next = line ? `${line} ${word}` : word; if (line && next.length * size * .6 > width) { out.push(line); line = word; } else line = next; }
    out.push(line);
  }
  return out;
};
export const size = (over: Partial<SizeSpec> = {}): SizeSpec => ({ id: 'main', ratio: 'square', guide: 'thirds', comp: null, ...over });
export const doc = (nodes: DocNode[] = [], spec: SizeSpec = size()): KuraDoc => ({ ...createDocument('k3f9', '2026-10-10T00:00:00.000Z', spec), nodes });
export const frame = (x: number, y: number, w: number, h: number, extra: Partial<Frame> = {}): Frame => ({ rect: { x, y, w, h }, rot: 0, ...extra });
export const rectNode = (id: string, f: Frame, extra: Partial<DocNode> = {}): DocNode => ({ id, kind: 'shape', shape: 'rect', fill: { role: 'accent' }, frames: { main: f }, ...extra } as DocNode);
export const textNode = (id: string, f: Frame, text = 'Hello', extra: Partial<DocNode> = {}): DocNode => ({ id, kind: 'text', text, weight: 400, align: 'start', fill: { role: 'ink' }, frames: { main: f }, ...extra } as DocNode);
export const ids = (() => { let n = 0; return () => `n${++n}`; });
/** Like fakeMeasure, but a word wider than the line breaks into characters, as the app's measurer does. */
export const charMeasure: Measure = (text, size, _weight, width) => {
  const out: string[] = [], fits = (s: string) => s.length * size * .6 <= width;
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) { line = next; continue; }
      if (line) { out.push(line); line = ''; }
      for (const ch of word) { if (line && !fits(line + ch)) { out.push(line); line = ''; } line += ch; }
    }
    out.push(line);
  }
  return out;
};
