import type { RatioDoc } from '../../core/document';
import { ratioById } from '../../core/ratios';
import { Canvas2DRenderer } from '../canvas/renderer';
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function exportDocument(doc: RatioDoc, images: Map<string, ImageBitmap>): Promise<void> {
  const canvas = document.createElement('canvas'); new Canvas2DRenderer(canvas).render(doc, { scale: ratioById(doc.ratio).exportWidth / 1000, images });
  const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
  download(png, `kura8-${doc.ratio}.png`);
}
