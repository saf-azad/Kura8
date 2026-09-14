import type { Rect, Size } from '../geometry';
export type GuideId = 'thirds' | 'golden' | 'divisions';
export type Anchor =
  | { kind: 'line'; id: string; axis: 'x' | 'y'; at: number }
  | { kind: 'point'; id: string; x: number; y: number }
  | { kind: 'region'; id: string; rect: Rect };
export type Guide = { id: GuideId; name: string; generate(canvas: Size): Anchor[] };
