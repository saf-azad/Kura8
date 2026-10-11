import type { Size } from './geometry';
import type { KuraDoc } from './document';
import type { Scene, SceneOp } from './scene';
import { coverCrop } from './images';
// Export writers with no dependencies: SVG from the scene (explicit tspans from our own line breaks, licences in
// <metadata>, 5u) and a one-page raster PDF around a JPEG (DCTDecode, hand-written xref).
export type Licence = { name: string; set: string; licence: string; source: string };
export type SvgImage = { href: string; natural: Size };
const n2 = (v: number) => +v.toFixed(2);
export const escapeXml = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Icons used by visible nodes in a size, one entry per icon (5u). */
export function licences(doc: KuraDoc, sizeId: string): Licence[] {
  const out: Licence[] = [];
  for (const n of doc.nodes) if (n.kind === 'shape' && n.icon && !n.frames[sizeId]?.hidden && !out.some(l => l.name === n.icon!.name && l.set === n.icon!.set))
    out.push({ name: n.icon.name, set: n.icon.set, licence: n.icon.licence, source: n.icon.set === 'phosphor' ? 'https://github.com/phosphor-icons/core' : n.icon.set });
  return out;
}
/** Distance from a line's middle down to its alphabetic baseline, from the app's font metrics (D-075). */
export type TextShift = (o: Extract<SceneOp, { kind: 'text' }>) => number;
function op(o: SceneOp, image: (o: Extract<SceneOp, { kind: 'image' }>) => SvgImage | undefined, shift?: TextShift): string {
  const { rect: r } = o, open = `<g transform="translate(${n2(r.x + r.w / 2)} ${n2(r.y + r.h / 2)}) rotate(${n2(o.rot)}) translate(${n2(-r.w / 2)} ${n2(-r.h / 2)})"${o.opacity !== undefined ? ` opacity="${n2(o.opacity)}"` : ''}>`;
  if (o.kind === 'shape') return `${open}<path fill-rule="evenodd" fill="${o.fill}"${o.scale ? ` transform="scale(${n2(o.scale[0])} ${n2(o.scale[1])})"` : ''} d="${o.d}"/></g>`;
  if (o.kind === 'text') {
    const x = (align: string) => align === 'left' ? 0 : align === 'center' ? r.w / 2 : r.w, anchor = (align: string, dir: string) => align === 'center' ? 'middle' : (align === 'left') === (dir === 'ltr') ? 'start' : 'end';
    // With app metrics the lines sit on their alphabetic baseline exactly where the canvas draws them; without, central.
    const dy = shift?.(o), base = dy === undefined ? ' dominant-baseline="central"' : '', y = (i: number) => n2(i * o.lineHeight + o.lineHeight / 2 + (dy ?? 0));
    const font = `font-family="${o.font.replace(/"/g, '\'')}" font-weight="${o.weight}" font-size="${n2(o.size)}" fill="${o.fill}"`;
    // Lines of differing direction are separate text elements, each its own bidi paragraph (D-064, D-075).
    if (o.bidi) return `${open}${o.lines.map((line, i) => { const b = o.bidi![i]; return `<text ${font} x="${n2(x(b.align))}" y="${y(i)}" text-anchor="${anchor(b.align, b.dir)}"${base}${b.dir === 'rtl' ? ' direction="rtl"' : ''} xml:space="preserve">${escapeXml(line)}</text>`; }).join('')}</g>`;
    const spans = o.lines.map((line, i) => `<tspan x="${n2(x(o.align))}" y="${y(i)}">${escapeXml(line)}</tspan>`).join('');
    return `${open}<text ${font} text-anchor="${anchor(o.align, o.dir)}"${base}${o.dir === 'rtl' ? ' direction="rtl"' : ''} xml:space="preserve">${spans}</text></g>`;
  }
  if (o.kind === 'ink') return `${open}<path fill="none" stroke="${o.fill}" stroke-width="${n2(o.stroke)}" stroke-linecap="round" stroke-linejoin="round" d="${o.paths.map(p => 'M' + p.map(([u, v]) => `${n2(u)} ${n2(v)}`).join('L')).join('')}"/></g>`;
  const img = o.asset ? image(o) : undefined;
  if (!img) return '';
  const c = coverCrop(img.natural, r, o.focus);
  return `${open}<svg width="${n2(r.w)}" height="${n2(r.h)}" viewBox="${n2(c.x)} ${n2(c.y)} ${n2(c.w)} ${n2(c.h)}" preserveAspectRatio="none"><image href="${escapeXml(img.href)}" width="${img.natural.w}" height="${img.natural.h}"/></svg></g>`;
}
/** SVG of a scene at `pixels` size. Empty image frames are left out; `ground: false` leaves the ground transparent. */
export function svg(scene: Scene, o: { pixels: Size; ground: boolean; fontCss?: string; licences: Licence[]; image: (op: Extract<SceneOp, { kind: 'image' }>) => SvgImage | undefined; textShift?: TextShift }): string {
  const { w, h } = scene.size;
  const meta = o.licences.length ? `<metadata><licences xmlns="urn:kura8:licences">${o.licences.map(l => `<icon name="${escapeXml(l.name)}" set="${escapeXml(l.set)}" licence="${escapeXml(l.licence)}" source="${escapeXml(l.source)}"/>`).join('')}</licences></metadata>` : '';
  const style = o.fontCss ? `<defs><style>${o.fontCss}</style></defs>` : '';
  const ground = o.ground ? `<rect width="${n2(w)}" height="${n2(h)}" fill="${scene.ground}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.pixels.w}" height="${o.pixels.h}" viewBox="0 0 ${n2(w)} ${n2(h)}">${meta}${style}${ground}${scene.ops.map(s => op(s, o.image, o.textShift)).join('')}</svg>`;
}
const ascii = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
const pdfText = (s: string) => s.replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7e]/g, '?');
/** One-page PDF showing a JPEG across a `page` of the given size in points. */
export function pdf(jpeg: Uint8Array, image: Size, page: Size, title = 'Kura8'): Uint8Array {
  const W = n2(page.w), H = n2(page.h), content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  const parts: (string | Uint8Array)[] = [], offsets: number[] = [];
  let length = 0;
  const push = (p: string | Uint8Array) => { parts.push(p); length += typeof p === 'string' ? p.length : p.length; };
  const obj = (body: (string | Uint8Array)[]) => { offsets.push(length); push(`${offsets.length} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  obj(['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  obj([`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
  obj([`<< /Type /XObject /Subtype /Image /Width ${image.w} /Height ${image.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
  obj([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
  obj([`<< /Producer (Kura8) /Title (${pdfText(title)}) >>`]);
  const xref = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R /Info ${offsets.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) { const bytes = typeof p === 'string' ? ascii(p) : p; out.set(bytes, at); at += bytes.length; }
  return out;
}
/** Page size in points: print sizes use their paper size, screen sizes 0.75 pt per pixel. */
export const pageSize = (pixels: Size, mm?: Size): Size => mm ? { w: mm.w / 25.4 * 72, h: mm.h / 25.4 * 72 } : { w: pixels.w * .75, h: pixels.h * .75 };
/**
 * A file-name stem from the design's headline (else its first visible text): words joined by hyphens, accents dropped
 * from Latin letters, other scripts kept (D-071), at most 40 characters; "kura8" when there is none. Without a size,
 * text hidden in some size still counts (All sizes).
 */
export function nameStem(doc: KuraDoc, sizeId?: string): string {
  const texts = doc.nodes.filter(n => n.kind === 'text' && !(sizeId && n.frames[sizeId]?.hidden) && n.text.trim());
  const pick = texts.find(n => n.slot === 'headline') ?? texts[0], text = pick?.kind === 'text' ? pick.text : '';
  const words = text.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  let stem = '';
  for (const w of words) { const next = stem ? `${stem}-${w}` : w; if (next.length > 40) break; stem = next; }
  return stem || (words[0] ?? '').slice(0, 40) || 'kura8';
}
