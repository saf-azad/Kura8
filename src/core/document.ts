import type { Rect, Size } from './geometry';
import type { GuideId } from './guides/types';
import { isFontId, type FontId } from './fonts';
import { isShapeId, type ShapeId } from './shapes';
export type RatioId = 'square' | 'portrait' | 'landscape' | 'story' | 'banner';
export type NodeType = 'text' | 'rect' | 'image';
export type NodeBase = { id: string; type: NodeType; rect: Rect };
export type TextNode = NodeBase & { type: 'text'; text: string; fontSize: number; weight: 400 | 700; align: 'left' | 'center' | 'right'; color: string; font: FontId };
export type RectNode = NodeBase & { type: 'rect'; fill: string; shape: ShapeId };
export type ImageNode = NodeBase & { type: 'image'; src: string; naturalSize: Size };
export type DocNode = TextNode | RectNode | ImageNode;
export type RatioDoc = { version: 1; id: string; ratio: RatioId; guide: GuideId | null; nodes: DocNode[]; createdAt: string };
export const createDocument = (id: string, ratio: RatioId, guide: GuideId | null, createdAt: string): RatioDoc => ({ version: 1, id, ratio, guide, nodes: [], createdAt });
const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const positive = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const size = (x: unknown): x is Size => object(x) && positive(x.w) && positive(x.h);
const color = (x: unknown): x is string => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
function node(x: unknown): x is DocNode {
  if (!object(x) || typeof x.id !== 'string' || !x.id || !object(x.rect) || !finite(x.rect.x) || !finite(x.rect.y) || !size(x.rect)) return false;
  switch (x.type) {
    case 'rect': return color(x.fill) && isShapeId(x.shape);
    case 'image': return typeof x.src === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(x.src) && size(x.naturalSize);
    case 'text': return typeof x.text === 'string' && positive(x.fontSize) && [400, 700].includes(x.weight as number) && ['left', 'center', 'right'].includes(x.align as string) && color(x.color) && isFontId(x.font);
    default: return false;
  }
}
export function validateDocument(x: unknown): x is RatioDoc {
  return object(x) && x.version === 1 && typeof x.id === 'string' && /^[a-z0-9]{4}$/.test(x.id)
    && ['square', 'portrait', 'landscape', 'story', 'banner'].includes(x.ratio as string)
    && (x.guide === null || ['thirds', 'golden', 'divisions'].includes(x.guide as string))
    && typeof x.createdAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x.createdAt) && Number.isFinite(Date.parse(x.createdAt))
    && Array.isArray(x.nodes) && x.nodes.every(node) && new Set(x.nodes.map(n => n.id)).size === x.nodes.length;
}
export function serialiseDocument(doc: RatioDoc): string {
  if (!validateDocument(doc)) throw new Error('Invalid Ratio document');
  return JSON.stringify(doc);
}
export function parseDocument(json: string): RatioDoc {
  const value: unknown = JSON.parse(json);
  if (!validateDocument(value)) throw new Error('Invalid Ratio document');
  return value;
}
