import type { Point, Rect } from './geometry';
import type { GuideId } from './guides/types';
import { isShape, ICON_SHAPE } from './shapes';
export type RatioId = 'square' | 'portrait' | 'tall' | 'story' | 'pin' | 'a4' | 'landscape' | 'link' | 'banner' | 'cover';
export type CompId = 'cover' | 'split' | 'stack' | 'poster' | 'frame' | 'band';
export type Role = 'ground' | 'ink' | 'accent';
export type RowId = 'base' | 'accent' | `c${number}`;
/** Lightness 92, 78, 64, 50, 36, 22, 10. */
export type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ColourRef = { role: Role } | { row: RowId; step: Step } | { hex: string };
export type Palette = { hue: number | null; dark: boolean; custom: string[]; accent?: string };
/** A node's geometry in one size. */
export type Frame = { rect: Rect; rot: number; fontSize?: number; hidden?: boolean };
export type Slot = 'image' | 'accent' | 'headline' | 'body';
/** `opacity` 0–1, absent means opaque (D-052); content, so shared by every size. */
type Base = { id: string; locked?: boolean; slot?: Slot; opacity?: number; /** A name the person gave it in Layers (D-066), at most 80 characters. */ name?: string; frames: Record<string, Frame> };
export type Align = 'start' | 'center' | 'end';
export type FontId = 'grotesk' | 'poppins' | 'playfair' | 'lora' | 'bebas' | 'caveat' | 'mono';
export type TextNode = Base & { kind: 'text'; text: string; weight: 400 | 700; align: Align; fill: ColourRef; fit?: boolean; font?: FontId };
export type Icon = { set: string; name: string; d: string; licence: string };
export type ShapeNode = Base & { kind: 'shape'; shape: string; fill: ColourRef; icon?: Icon };
export type ImageNode = Base & { kind: 'image'; asset: string | null; cutout?: boolean; focus?: Point };
export type InkForm = 'line' | 'arrow' | 'rect' | 'ellipse' | 'tri';
export type InkNode = Base & { kind: 'ink'; paths: [number, number][][]; stroke: number; fill: ColourRef; form?: InkForm };
export type DocNode = TextNode | ShapeNode | ImageNode | InkNode;
export type NodeKind = DocNode['kind'];
export type SizeSpec = { id: string; ratio: RatioId; guide: GuideId | null; comp: CompId | null };
export type KuraDoc = { version: 2; id: string; createdAt: string; palette: Palette; ground: ColourRef | null; sizes: SizeSpec[]; nodes: DocNode[] };

/** Dial ring order: upright formats, then wide ones (D-069). */
export const ratioIds: RatioId[] = ['square', 'portrait', 'tall', 'story', 'pin', 'a4', 'landscape', 'link', 'banner', 'cover'];
export const compIds: CompId[] = ['cover', 'split', 'stack', 'poster', 'frame', 'band'];
export const guideIds: GuideId[] = ['thirds', 'golden', 'divisions'];
export const fontIds: FontId[] = ['grotesk', 'poppins', 'playfair', 'lora', 'bebas', 'caveat', 'mono'];
export const neutralPalette = (): Palette => ({ hue: null, dark: false, custom: [] });
export function createDocument(id: string, createdAt: string, size: SizeSpec, palette: Palette = neutralPalette()): KuraDoc {
  return { version: 2, id, createdAt, palette, ground: null, sizes: [size], nodes: [] };
}
export const frameOf = (node: DocNode, sizeId: string): Frame => node.frames[sizeId];
export const sizeOf = (doc: KuraDoc, sizeId: string): SizeSpec => doc.sizes.find(s => s.id === sizeId) ?? doc.sizes[0];

const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const positive = (x: unknown): x is number => finite(x) && x > 0;
const optionalBool = (x: unknown) => x === undefined || typeof x === 'boolean';
export const isHex = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
const oneOf = <T>(list: readonly T[], x: unknown): x is T => list.includes(x as T);
const rect = (x: unknown): x is Rect => object(x) && finite(x.x) && finite(x.y) && positive(x.w) && positive(x.h);
export function validColour(x: unknown): x is ColourRef {
  if (!object(x)) return false;
  const keys = Object.keys(x).sort().join();
  if (keys === 'role') return oneOf(['ground', 'ink', 'accent'], x.role);
  if (keys === 'row,step') return typeof x.row === 'string' && /^(base|accent|c\d+)$/.test(x.row) && Number.isInteger(x.step) && (x.step as number) >= 0 && (x.step as number) <= 6;
  return keys === 'hex' && isHex(x.hex);
}
function palette(x: unknown): x is Palette {
  return object(x) && (x.hue === null || finite(x.hue) && x.hue >= 0 && x.hue < 360) && typeof x.dark === 'boolean'
    && Array.isArray(x.custom) && x.custom.every(isHex) && (x.accent === undefined || isHex(x.accent));
}
function frame(x: unknown): x is Frame {
  return object(x) && rect(x.rect) && finite(x.rot) && (x.fontSize === undefined || positive(x.fontSize)) && optionalBool(x.hidden);
}
const point = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2 && finite(x[0]) && finite(x[1]);
function node(x: unknown, sizeIds: string[]): x is DocNode {
  if (!object(x) || typeof x.id !== 'string' || !x.id || !optionalBool(x.locked)) return false;
  if (x.opacity !== undefined && !(finite(x.opacity) && x.opacity >= 0 && x.opacity <= 1)) return false;
  if (x.name !== undefined && !(typeof x.name === 'string' && x.name.trim() !== '' && x.name.length <= 80)) return false;
  if (x.slot !== undefined && !oneOf(['image', 'accent', 'headline', 'body'], x.slot)) return false;
  if (!object(x.frames) || Object.keys(x.frames).length !== sizeIds.length || !sizeIds.every(id => frame((x.frames as Record<string, unknown>)[id]))) return false;
  switch (x.kind) {
    case 'text': return typeof x.text === 'string' && oneOf([400, 700], x.weight) && oneOf(['start', 'center', 'end'], x.align) && validColour(x.fill) && optionalBool(x.fit) && (x.font === undefined || oneOf(fontIds, x.font));
    case 'shape': {
      if (typeof x.shape !== 'string' || !validColour(x.fill)) return false;
      if (x.shape === ICON_SHAPE) return object(x.icon) && ['set', 'name', 'd', 'licence'].every(k => typeof (x.icon as Record<string, unknown>)[k] === 'string' && (x.icon as Record<string, string>)[k] !== '');
      return isShape(x.shape) && x.icon === undefined;
    }
    case 'image': return (x.asset === null || typeof x.asset === 'string' && x.asset !== '') && optionalBool(x.cutout)
      && (x.focus === undefined || object(x.focus) && finite(x.focus.x) && finite(x.focus.y) && x.focus.x >= 0 && x.focus.x <= 1 && x.focus.y >= 0 && x.focus.y <= 1);
    case 'ink': return Array.isArray(x.paths) && x.paths.length > 0 && x.paths.every(p => Array.isArray(p) && p.length > 0 && p.every(point)) && positive(x.stroke) && validColour(x.fill)
      && (x.form === undefined || oneOf(['line', 'arrow', 'rect', 'ellipse', 'tri'], x.form));
    default: return false;
  }
}
function size(x: unknown): x is SizeSpec {
  return object(x) && typeof x.id === 'string' && x.id !== '' && oneOf(ratioIds, x.ratio) && (x.guide === null || oneOf(guideIds, x.guide)) && (x.comp === null || oneOf(compIds, x.comp));
}
export function validateDocument(x: unknown): x is KuraDoc {
  if (!object(x) || x.version !== 2 || typeof x.id !== 'string' || !/^[a-z0-9]{4}$/.test(x.id)) return false;
  if (typeof x.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x.createdAt) || !Number.isFinite(Date.parse(x.createdAt))) return false;
  if (!palette(x.palette) || !(x.ground === null || validColour(x.ground))) return false;
  if (!Array.isArray(x.sizes) || !x.sizes.length || !x.sizes.every(size)) return false;
  const sizeIds = x.sizes.map(s => s.id);
  if (new Set(sizeIds).size !== sizeIds.length) return false;
  return Array.isArray(x.nodes) && x.nodes.every(n => node(n, sizeIds)) && new Set(x.nodes.map(n => n.id)).size === x.nodes.length;
}
export function serialiseDocument(doc: KuraDoc): string {
  if (!validateDocument(doc)) throw new Error('Invalid Kura8 document');
  return JSON.stringify(doc);
}
export function parseDocument(json: string): KuraDoc {
  const value: unknown = JSON.parse(json);
  if (!validateDocument(value)) throw new Error('Invalid Kura8 document');
  return value;
}

/** An image the app must write to the asset store before saving a migrated document. */
export type InlineImage = { asset: string; dataUrl: string };
const shapeNames: Record<string, string> = { rectangle: 'rect', ellipse: 'circle', triangle: 'tri', diamond: 'diamond', star: 'star5', arrow: 'arrowR' };
type V1Node = { id: string; type: 'text' | 'rect' | 'image'; rect: Rect; locked?: boolean; text?: string; fontSize?: number; weight?: 400 | 700; align?: 'left' | 'center' | 'right'; color?: string; fill?: string; shape?: string; src?: string };
/** Turns a Phase 0 (version 1) document into version 2 with one size; version 2 passes through. Throws on anything else. */
export function migrate(x: unknown, sizeId = 'main'): { doc: KuraDoc; inline: InlineImage[] } {
  if (validateDocument(x)) return { doc: x, inline: [] };
  if (!object(x) || x.version !== 1 || !Array.isArray(x.nodes)) throw new Error('Unknown Kura8 document');
  const inline: InlineImage[] = [];
  const nodes = (x.nodes as V1Node[]).map((n): DocNode => {
    const base = { id: n.id, ...(n.locked ? { locked: true } : {}), frames: { [sizeId]: { rect: { ...n.rect }, rot: 0, ...(n.type === 'text' ? { fontSize: n.fontSize } : {}) } } };
    if (n.type === 'text') return { ...base, kind: 'text', text: n.text ?? '', weight: n.weight ?? 400, align: n.align === 'right' ? 'end' : n.align === 'center' ? 'center' : 'start', fill: { hex: (n.color ?? '#111111').toLowerCase() } };
    if (n.type === 'rect') return { ...base, kind: 'shape', shape: shapeNames[n.shape ?? 'rectangle'] ?? 'rect', fill: { hex: (n.fill ?? '#111111').toLowerCase() } };
    const asset = `v1-${n.id}`; inline.push({ asset, dataUrl: n.src ?? '' });
    return { ...base, kind: 'image', asset };
  });
  const doc: KuraDoc = { version: 2, id: String(x.id), createdAt: String(x.createdAt), palette: neutralPalette(), ground: null,
    sizes: [{ id: sizeId, ratio: x.ratio as RatioId, guide: (x.guide ?? null) as GuideId | null, comp: null }], nodes };
  if (!validateDocument(doc)) throw new Error('Invalid version 1 document');
  return { doc, inline };
}
