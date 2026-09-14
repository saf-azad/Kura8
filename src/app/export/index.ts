import type { RatioDoc } from '../../core/document';
import { serialiseDocument } from '../../core/document';
import { ratioById } from '../../core/ratios';
import { Canvas2DRenderer } from '../canvas/renderer';
import type { Mode } from '../store';
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportDocument(doc: RatioDoc, mode: Mode, images: Map<string, ImageBitmap>): Promise<void> {
  const canvas = document.createElement('canvas'); new Canvas2DRenderer(canvas).render(doc, { scale: ratioById(doc.ratio).exportWidth / 1000, images });
  const json = serialiseDocument(doc);
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
  download(png, `${doc.id}-${mode}.png`); download(new Blob([json], { type: 'application/json' }), `${doc.id}-${mode}.json`);
}
