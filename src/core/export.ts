import type { Size } from './geometry';
import type { KuraDoc } from './document';
import { gradientLine, type Scene, type SceneOp } from './scene';
import { scalePath } from './shapes';
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
/** An outline at its drawn size: box shapes already are, path shapes are scaled out of their 100-unit box. */
const sized = (o: { d: string; scale?: [number, number] }): string => o.scale ? scalePath(o.d, o.scale[0], o.scale[1]) : o.d;
function op(o: SceneOp, image: (o: Extract<SceneOp, { kind: 'image' }>) => SvgImage | undefined, def: (body: (id: string) => string) => string): string {
  const { rect: r, fx } = o, flip = fx?.flip ? ` scale(${fx.flip[0] ? -1 : 1} ${fx.flip[1] ? -1 : 1})` : '';
  const open = `<g transform="translate(${n2(r.x + r.w / 2)} ${n2(r.y + r.h / 2)}) rotate(${n2(o.rot)})${flip} translate(${n2(-r.w / 2)} ${n2(-r.h / 2)})">`;
  // An inside border: the outline stroked twice as wide and clipped to itself.
  const border = (d: string) => { if (!fx?.outline) return ''; const clip = def(id => `<clipPath id="${id}"><path d="${d}"/></clipPath>`); return `<path fill="none" stroke="${fx.outline.colour}" stroke-width="${n2(fx.outline.width * 2)}" clip-path="url(#${clip})" d="${d}"/>`; };
  let body: string;
  if (o.kind === 'shape') {
    const d = sized(o), g = o.gradient && gradientLine(r.w, r.h, o.gradient.angle);
    const fill = o.gradient && g ? `url(#${def(id => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n2(g[0])}" y1="${n2(g[1])}" x2="${n2(g[2])}" y2="${n2(g[3])}"><stop offset="0" stop-color="${o.gradient!.from}"/><stop offset="1" stop-color="${o.gradient!.to}"/></linearGradient>`)})` : o.fill;
    body = `${open}<path fill-rule="evenodd" fill="${fill}" d="${d}"/>${border(d)}</g>`;
  } else if (o.kind === 'text') {
    const x = o.align === 'left' ? 0 : o.align === 'center' ? r.w / 2 : r.w, anchor = o.align === 'center' ? 'middle' : (o.align === 'left') === (o.dir === 'ltr') ? 'start' : 'end';
    const spans = o.lines.map((line, i) => `<tspan x="${n2(x)}" y="${n2(i * o.lineHeight + o.lineHeight / 2)}">${escapeXml(line)}</tspan>`).join('');
    const style = (o.italic ? ' font-style="italic"' : '') + (o.underline ? ' text-decoration="underline"' : '') + (o.spacing ? ` letter-spacing="${n2(o.spacing)}"` : '')
      + (fx?.outline ? ` stroke="${fx.outline.colour}" stroke-width="${n2(fx.outline.width * 2)}" stroke-linejoin="round" paint-order="stroke"` : '');
    body = `${open}<text font-family="${o.font.replace(/"/g, '\'')}" font-weight="${o.weight}" font-size="${n2(o.size)}" fill="${o.fill}" text-anchor="${anchor}" dominant-baseline="central"${style}${o.dir === 'rtl' ? ' direction="rtl"' : ''} xml:space="preserve">${spans}</text></g>`;
  } else if (o.kind === 'ink') body = `${open}<path fill="none" stroke="${o.fill}" stroke-width="${n2(o.stroke)}" stroke-linecap="round" stroke-linejoin="round" d="${o.paths.map(p => 'M' + p.map(([u, v]) => `${n2(u)} ${n2(v)}`).join('L')).join('')}"/></g>`;
  else {
    const img = o.asset ? image(o) : undefined;
    if (!img) return '';
    const c = coverCrop(img.natural, r, o.focus, o.zoom), outline = o.mask ? sized(o.mask) : `M0 0H${n2(r.w)}V${n2(r.h)}H0Z`;
    const picture = `<svg width="${n2(r.w)}" height="${n2(r.h)}" viewBox="${n2(c.x)} ${n2(c.y)} ${n2(c.w)} ${n2(c.h)}" preserveAspectRatio="none"><image href="${escapeXml(img.href)}" width="${img.natural.w}" height="${img.natural.h}"/></svg>`;
    const clipped = o.mask ? `<g clip-path="url(#${def(id => `<clipPath id="${id}"><path d="${outline}"/></clipPath>`)})">${picture}</g>` : picture;
    body = `${open}${clipped}${border(outline)}</g>`;
  }
  const shadow = fx?.shadow && def(id => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${n2(fx.shadow!.x)}" dy="${n2(fx.shadow!.y)}" stdDeviation="${n2(fx.shadow!.blur / 2)}" flood-color="${fx.shadow!.colour}" flood-opacity="${n2(fx.shadow!.alpha)}"/></filter>`);
  const attrs = (fx?.opacity !== undefined ? ` opacity="${n2(fx.opacity)}"` : '') + (shadow ? ` filter="url(#${shadow})"` : '');
  return attrs ? `<g${attrs}>${body}</g>` : body;
}
/** SVG of a scene at `pixels` size. Empty image frames are left out; `ground: false` leaves the ground transparent. */
export function svg(scene: Scene, o: { pixels: Size; ground: boolean; fontCss?: string; licences: Licence[]; image: (op: Extract<SceneOp, { kind: 'image' }>) => SvgImage | undefined }): string {
  const { w, h } = scene.size;
  const meta = o.licences.length ? `<metadata><licences xmlns="urn:kura8:licences">${o.licences.map(l => `<icon name="${escapeXml(l.name)}" set="${escapeXml(l.set)}" licence="${escapeXml(l.licence)}" source="${escapeXml(l.source)}"/>`).join('')}</licences></metadata>` : '';
  const defs: string[] = [], def = (body: (id: string) => string) => { const id = `k${defs.length + 1}`; defs.push(body(id)); return id; };
  const ops = scene.ops.map(s => op(s, o.image, def)).join('');
  const style = o.fontCss || defs.length ? `<defs>${o.fontCss ? `<style>${o.fontCss}</style>` : ''}${defs.join('')}</defs>` : '';
  const ground = o.ground ? `<rect width="${n2(w)}" height="${n2(h)}" fill="${scene.ground}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.pixels.w}" height="${o.pixels.h}" viewBox="0 0 ${n2(w)} ${n2(h)}">${meta}${style}${ground}${ops}</svg>`;
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
