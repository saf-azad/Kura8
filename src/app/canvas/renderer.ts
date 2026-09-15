import type { RatioDoc, TextNode } from '../../core/document';
import { shapePath } from './shapes';
import { canvasSize } from '../../core/ratios';
export interface Renderer { render(doc: RatioDoc, opts: { scale: number; images: Map<string, ImageBitmap> }): void; }
export const FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export function textLines(ctx: CanvasRenderingContext2D, node: TextNode): string[] {
  ctx.font = `${node.weight} ${node.fontSize}px ${FONT}`;
  const result: string[] = [];
  for (const paragraph of node.text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > node.rect.w) { result.push(line); line = ''; }
      // Long unbroken words wrap at character boundaries.
      for (const char of (line ? ` ${word}` : word)) {
        if (line && ctx.measureText(line + char).width > node.rect.w) { result.push(line); line = ''; }
        line += char;
      }
    }
    result.push(line);
  }
  return result;
}
export function measureText(ctx: CanvasRenderingContext2D, node: TextNode): number { return Math.max(20, textLines(ctx, node).length * node.fontSize * 1.2); }
export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }
  render(doc: RatioDoc, { scale, images }: { scale: number; images: Map<string, ImageBitmap> }): void {
    const size = canvasSize(doc.ratio);
    this.canvas.width = Math.round(size.w * scale); this.canvas.height = Math.round(size.h * scale);
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size.w, size.h);
    for (const node of doc.nodes) {
      const { x, y, w, h } = node.rect;
      if (node.type === 'rect') { ctx.fillStyle = node.fill; ctx.fill(shapePath(node)); }
      else if (node.type === 'image') { const image = images.get(node.id); if (image) ctx.drawImage(image, x, y, w, h); }
      else {
        const lines = textLines(ctx, node); ctx.fillStyle = node.color; ctx.textBaseline = 'top'; ctx.textAlign = node.align;
        const tx = x + (node.align === 'left' ? 0 : node.align === 'center' ? w / 2 : w);
        lines.forEach((line, i) => ctx.fillText(line, tx, y + i * node.fontSize * 1.2));
      }
    }
  }
}
