import type { ColourRef, DocNode, Gradient, NodeKind, Outline, Shadow, TextNode, ImageNode } from './document';
// Copy style (D-045): the look of one node pasted onto others, never its content or geometry. Each key travels only
// between kinds that both have it; a key the source lacks is removed from the target, so the target matches.
export type Style = {
  from: NodeKind; fill?: ColourRef; gradient?: Gradient; opacity?: number; shadow?: Shadow; outline?: Outline;
  text?: Pick<TextNode, 'weight' | 'font' | 'italic' | 'underline' | 'upper' | 'spacing' | 'leading'>;
  image?: Pick<ImageNode, 'adjust' | 'duotone' | 'mask'>;
};
const TEXT = ['weight', 'font', 'italic', 'underline', 'upper', 'spacing', 'leading'] as const;
const IMAGE = ['adjust', 'duotone', 'mask'] as const;
const pick = <T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, structuredClone(o[k])])) as Pick<T, K>;
export function styleOf(n: DocNode): Style {
  const s: Style = structuredClone({ from: n.kind, ...pick(n, ['opacity', 'shadow']) });
  if (n.kind !== 'image') s.fill = structuredClone(n.fill);
  if (n.kind !== 'ink' && n.outline) s.outline = structuredClone(n.outline);
  if (n.kind === 'shape' && n.gradient) s.gradient = structuredClone(n.gradient);
  if (n.kind === 'text') s.text = pick(n, TEXT);
  if (n.kind === 'image') s.image = pick(n, IMAGE);
  return s;
}
const set = <T extends object>(o: T, key: string, value: unknown, carries: boolean) => {
  if (!carries) return;
  const r = o as Record<string, unknown>;
  if (value === undefined) delete r[key]; else r[key] = structuredClone(value);
};
export function applyStyle(n: DocNode, s: Style): DocNode {
  const out = { ...n } as DocNode, painted = (k: NodeKind) => k !== 'image', outlined = (k: NodeKind) => k !== 'ink';
  set(out, 'opacity', s.opacity, true); set(out, 'shadow', s.shadow, true);
  set(out, 'outline', s.outline, outlined(n.kind) && outlined(s.from));
  if (out.kind !== 'image' && s.fill && painted(s.from)) out.fill = structuredClone(s.fill);
  set(out, 'gradient', s.gradient, n.kind === 'shape' && painted(s.from));
  if (out.kind === 'text' && s.text) { for (const k of TEXT) if (k !== 'weight') set(out, k, s.text[k], true); out.weight = s.text.weight; }
  if (out.kind === 'image' && s.image) for (const k of IMAGE) set(out, k, s.image[k], true);
  return out;
}
