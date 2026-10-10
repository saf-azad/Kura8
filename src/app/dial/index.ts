import type { CompId, KuraDoc, RatioId } from '../../core/document';
import { compIds, ratioIds, guideIds } from '../../core/document';
import type { GuideId } from '../../core/guides/types';
import { fractionsOf, guideById } from '../../core/guides';
import { RINGS, ringPath, rotationFor, indexAt, detent, settle, type RingKey } from '../../core/dial';
import { canvasSize, exportSize, ratioById, ratioNumbers } from '../../core/ratios';
import { layout, compositionFit, type FitReason } from '../../core/compositions';
import { hsl, hsvToHex, hexToHsv, HUES, resolve } from '../../core/palette';
import { norm, modn } from '../../core/geometry';
import { measure } from '../measure';
import { Canvas2DRenderer, type ImageSource } from '../canvas/renderer';
import type { DialSettings } from '../store';
import { h, ICON } from '../ui';
// The dial (M7): four rings (ratio, layout, guide, colour) turned by drag, scroll, arrows or Enter; the hub previews
// the canvas you get. 5a destination labels and hover preview, 5b opens on the last setting with a hub tap going
// straight to the canvas, 5c unsuited layouts dim with the reason, 5f the hub shows the current canvas re-laid.
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string | number> = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };
const COMP_NAMES: Record<CompId, string> = { cover: 'Cover', split: 'Split', stack: 'Stack', poster: 'Poster', frame: 'Frame', band: 'Band' };
const HUE_STOPS: (number | null)[] = [...HUES, null];
const REASONS: Record<FitReason, (ratio: string) => string> = { narrow: r => `Columns too narrow at ${r}`, shallow: r => `Bands too shallow at ${r}`, overflow: r => `Text runs off the canvas at ${r}` };
const pct = (f: number) => String(Math.round(f * 1000) / 10);
function describe(comp: CompId, guide: GuideId): string {
  const F = fractionsOf(guide), a = F[0], b = F[F.length - 1];
  return { cover: `Image down to ${pct(b)}%, headline off the ${pct(a)}% column`, split: `Image in the left ${pct(a)}%, text beside it, accent in the bottom-right cell`,
    stack: `Headline on top, image between ${pct(a)}% and ${pct(b)}%, body under`, poster: `Type across the top, accent band from ${pct(b)}% down`,
    frame: 'Image in the centre cell, headline under it, body top-right', band: `Image in the right ${pct(1 - b)}%, headline on the ${pct(a)}% line` }[comp];
}
export type DialHost = {
  settings(): DialSettings; set(patch: Partial<DialSettings>): void;
  hasDoc(): boolean; preview(s: DialSettings): KuraDoc; image: ImageSource;
  start(): void; fresh(): void; back(): void;
};
export function showDial(root: HTMLElement, host: DialHost): { paint(): void; destroy(): void } {
  const index = (key: RingKey, s = host.settings()): number => key === 'ratio' ? ratioIds.indexOf(s.ratio) : key === 'comp' ? compIds.indexOf(s.comp) : key === 'guide' ? guideIds.indexOf(s.guide) : HUE_STOPS.indexOf(s.hue);
  const patchFor = (key: RingKey, i: number): Partial<DialSettings> => key === 'ratio' ? { ratio: ratioIds[i] } : key === 'comp' ? { comp: compIds[i] } : key === 'guide' ? { guide: guideIds[i] } : { hue: HUE_STOPS[i] };
  const rot: Record<RingKey, number> = { ratio: 0, comp: 0, guide: 0, hue: 0 };
  // A small opening turn into the saved settings (the prototype's first spin).
  for (const r of RINGS) rot[r.key] = rotationFor(0, index(r.key), r.n) + [60, -50, 80, -70][RINGS.indexOf(r)];
  let focus = 0, hoverRing: number | null = null, hoverRatio: RatioId | null = null, dragging: RingKey | null = null, lastWheel = 0;
  const wheel = svg('svg', { viewBox: '0 0 640 640', width: 640, height: 640, role: 'group', 'aria-label': 'Dial' }) as SVGSVGElement;
  wheel.append(svg('path', { d: 'M312 -16H328L320 -5Z', fill: '#000' }));
  const ringEls = RINGS.map((r, ri) => {
    const g = svg('g', { class: 'ring' }) as SVGGElement;
    g.addEventListener('wheel', e => {
      e.preventDefault(); const now = Date.now(), dv = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(dv) < 3 || now - lastWheel < 130) return;
      lastWheel = now; focus = ri; pick(r.key, modn(index(r.key) + (dv > 0 ? 1 : -1), r.n));
    }, { passive: false });
    g.addEventListener('pointerenter', () => { hoverRing = ri; paint(); });
    g.addEventListener('pointerleave', () => { hoverRing = null; paint(); });
    wheel.append(g); return g;
  });
  const hueWindow = svg('path', { d: ringPath(320, 320, 144, 107, 0, 13).d, fill: 'none', stroke: '#000', 'stroke-width': 2, style: 'pointer-events:none;transition:opacity 280ms' });
  wheel.append(hueWindow, svg('circle', { cx: 320, cy: 320, r: 106, fill: '#ECF0F3', stroke: '#000', 'stroke-width': 2 }));
  const hubCanvas = h('canvas'), hub = h('button', { type: 'button', className: 'hub', title: 'Start (Enter)', 'aria-label': 'Go to the canvas' }, hubCanvas, h('span', { className: 'go', html: ICON.go }));
  hub.addEventListener('click', () => host.start());
  const wheelBox = h('div', { className: 'wheel' }, wheel, hub);
  const cards = RINGS.map((_, i) => { const c = h('button', { type: 'button', className: 'card' }, h('span', { className: 'name' }), h('span', { className: 'value' }), h('span', { className: 'sub' })); c.addEventListener('click', () => { focus = i; paint(); }); return c; });
  const sv = h('div', { className: 'sv', title: 'Drag to set the accent to any colour', style: 'height:130px' }, h('i')), hueBar = h('div', { className: 'hue-bar', title: 'Drag to change hue' }, h('i'));
  const anyChip = h('span', { className: 'dot', style: 'width:14px;height:14px' }), anyHex = h('span');
  const any = h('div', { className: 'any-colour' }, h('div', { className: 'row' }, h('span', { className: 'muted', style: 'font-size:11px' }, 'Any colour'), h('span', { style: 'display:flex;align-items:center;gap:6px;font-size:12px' }, anyChip, anyHex)), sv, hueBar, h('div', { className: 'muted', style: 'font-size:11px;line-height:1.35' }, 'Sets the accent. Turning the colour ring resets it.'));
  let pickHsv = hexToHsv(host.settings().accent ?? '#3d7ccc');
  const picker = (el: HTMLElement, kind: 'sv' | 'h') => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); const r = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => { const fx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), fy = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)); pickHsv = kind === 'sv' ? { ...pickHsv, s: Math.round(fx * 100), v: Math.round((1 - fy) * 100) } : { ...pickHsv, h: Math.round(fx * 359) }; host.set({ accent: hsvToHex(pickHsv.h, pickHsv.s, pickHsv.v) }); };
    at(e); const move = (ev: PointerEvent) => at(ev), up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
  picker(sv, 'sv'); picker(hueBar, 'h');
  const light = h('button', { type: 'button', title: 'Light ground', 'aria-label': 'Light ground' }, h('i', { style: 'background:#ECF0F3' })), dark = h('button', { type: 'button', title: 'Dark ground', 'aria-label': 'Dark ground' }, h('i', { style: 'background:#000' }));
  light.addEventListener('click', () => host.set({ dark: false })); dark.addEventListener('click', () => host.set({ dark: true }));
  const startLabel = h('span'), start = h('button', { type: 'button', className: 'solid' }, startLabel, h('span', { html: ICON.go, style: 'display:grid' }));
  start.addEventListener('click', () => host.start());
  const fresh = h('button', { type: 'button', className: 'outline', title: 'Start a new design from the dial; Undo brings the old one back' }, 'New');
  fresh.addEventListener('click', () => host.fresh());
  const back = h('button', { type: 'button', className: 'outline', title: 'Back to canvas without changes' }, 'Back to canvas');
  back.addEventListener('click', () => host.back());
  const actions = h('div', { className: 'dial-actions' }, h('div', { className: 'ground-toggle' }, light, dark), start, fresh, back);
  const hints = h('div', { className: 'dial-hints' }, h('div', { className: 'muted' }, 'Drag or scroll a ring to turn it'),
    h('div', {}, h('span', { className: 'muted', style: 'margin-right:5px' }, 'Choose ring'), h('span', { className: 'key' }, '↑'), h('span', { className: 'key' }, '↓')),
    h('div', {}, h('span', { className: 'muted', style: 'margin-right:5px' }, 'Turn'), h('span', { className: 'key' }, '←'), h('span', { className: 'key' }, '→')),
    h('div', {}, h('span', { className: 'muted', style: 'margin-right:5px' }, 'Start'), h('span', { className: 'key' }, 'Enter')));
  const screen = h('div', { className: 'dial' }, h('div', { className: 'wordmark' }, 'Kura8'), h('div', { className: 'readout-cards' }, ...cards), wheelBox, any, actions, hints);
  root.replaceChildren(screen);
  function pick(key: RingKey, i: number): void { const r = RINGS.find(x => x.key === key)!; rot[key] = rotationFor(rot[key], i, r.n); host.set(patchFor(key, i)); }
  // ring dragging
  const angleAt = (e: PointerEvent) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  wheel.addEventListener('pointerdown', e => {
    const seg = (e.target as Element).closest('[data-ring]');
    if (!seg || e.button !== 0) return;
    e.preventDefault();
    const key = seg.getAttribute('data-ring') as RingKey, i = Number(seg.getAttribute('data-index')), ring = RINGS.find(r => r.key === key)!;
    focus = RINGS.indexOf(ring);
    const d = { last: angleAt(e), acc: 0, r0: rot[key], moved: false, x: e.clientX, y: e.clientY };
    wheel.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const a = angleAt(ev); d.acc += norm(a - d.last); d.last = a;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) d.moved = true;
      if (!d.moved) return;
      dragging = key; const raw = d.r0 + d.acc, idx = indexAt(raw, ring.n);
      rot[key] = detent(raw, ring.n);
      if (idx !== index(key)) { try { navigator.vibrate?.(6); } catch { /* unsupported */ } host.set(patchFor(key, idx)); } else paint();
    };
    const up = () => {
      wheel.removeEventListener('pointermove', move); wheel.removeEventListener('pointerup', up); wheel.removeEventListener('pointercancel', up);
      dragging = null;
      if (!d.moved) pick(key, i); else { rot[key] = settle(d.r0 + d.acc, ring.n); paint(); }
    };
    wheel.addEventListener('pointermove', move); wheel.addEventListener('pointerup', up); wheel.addEventListener('pointercancel', up);
  });
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as Element).closest?.('input, textarea')) return;
    if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); host.start(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); focus = modn(focus + (e.key === 'ArrowDown' ? 1 : -1), 4); paint(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const r = RINGS[focus]; pick(r.key, modn(index(r.key) + (e.key === 'ArrowRight' ? 1 : -1), r.n)); }
  };
  document.addEventListener('keydown', onKey);
  const onResize = () => paint();
  window.addEventListener('resize', onResize);
  // Persistent segment elements per ring, so turning animates and hovering never rebuilds what is under the pointer.
  type Seg = { g: SVGGElement; path: SVGPathElement; content: SVGGElement; c: [number, number]; built: string };
  const segs: Seg[][] = RINGS.map((r, ri) => Array.from({ length: r.n }, (_, i) => {
    const { d, c } = ringPath(320, 320, r.ro, r.ri, i, r.n);
    const g = svg('g', { 'data-ring': r.key, 'data-index': i }) as SVGGElement, path = svg('path', { d, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', class: 'seg-path' }) as SVGPathElement;
    const content = svg('g', { style: `transform-origin:${c[0]}px ${c[1]}px;pointer-events:none` }) as SVGGElement;
    g.append(path, content); ringEls[ri].append(g);
    if (r.key === 'ratio') { g.addEventListener('pointerenter', () => { hoverRatio = ratioIds[i]; paint(); }); g.addEventListener('pointerleave', () => { hoverRatio = null; paint(); }); }
    return { g, path, content, c, built: '' };
  }));
  function updateSegments(ri: number): void {
    const r = RINGS[ri], s = host.settings(), cur = index(r.key), active = focus === ri, hovered = hoverRing === ri, show = active ? 1 : hovered ? .5 : 0;
    segs[ri].forEach((seg, i) => {
      const { c } = seg, sel = i === cur, on = sel && active && r.key !== 'hue', ink = on ? '#fff' : '#000';
      let fill = on ? '#000' : !active && sel ? 'rgba(156,171,194,.35)' : 'rgba(236,240,243,0)', stroke = active ? '#000' : 'rgba(0,0,0,.15)', opacity = show, tip = '';
      const text = (t: string, dy: number, size = 11, extra = '') => { const el = svg('text', { x: c[0], y: c[1] + dy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size, fill: ink, style: extra }); el.textContent = t; return el; };
      const build = (key: string, make: () => SVGElement[]) => { if (seg.built !== key) { seg.built = key; seg.content.replaceChildren(...make()); } };
      if (r.key === 'ratio') {
        const id = ratioIds[i], cs = canvasSize(id), k = 16 / Math.max(cs.w, cs.h);
        build(ink, () => [svg('rect', { x: c[0] - cs.w * k / 2, y: c[1] - 10 - cs.h * k / 2, width: cs.w * k, height: cs.h * k, fill: 'none', stroke: ink, 'stroke-width': 2 }), text(ratioNumbers(id), 5), text(ratioById(id).label, 15, 8.5, 'opacity:.7')]);
        tip = `${ratioById(id).label} ${ratioNumbers(id)}`;
      } else if (r.key === 'comp') {
        const comp = compIds[i], fit = compositionFit({ canvas: canvasSize(s.ratio), guide: s.guide, comp, measure, headline: 'Headline', body: 'Body text' });
        build(`${ink}|${s.ratio}|${s.guide}`, () => [thumb(comp, s.ratio, s.guide, c[0], c[1] - 10, ink), text(COMP_NAMES[comp], 25)]);
        if (!fit.ok) { opacity = show * .35; tip = REASONS[fit.reason](ratioNumbers(s.ratio)); } else tip = `${COMP_NAMES[comp]}: ${describe(comp, s.guide)}`;
        seg.g.setAttribute('aria-disabled', String(!fit.ok));
      } else if (r.key === 'guide') {
        const gx = c[0] - 10, gy = c[1] - 16, F = fractionsOf(guideIds[i]);
        build(ink, () => [svg('rect', { x: gx, y: gy, width: 20, height: 20, fill: 'none', stroke: ink, 'stroke-width': 1.5 }),
          ...F.flatMap(f => [svg('line', { x1: gx + 20 * f, y1: gy, x2: gx + 20 * f, y2: gy + 20, stroke: ink, 'stroke-width': 1 }), svg('line', { x1: gx, y1: gy + 20 * f, x2: gx + 20, y2: gy + 20 * f, stroke: ink, 'stroke-width': 1 })]), text(guideById(guideIds[i]).name, 14, 10)]);
        tip = guideById(guideIds[i]).name;
      } else {
        const hue = HUE_STOPS[i];
        if (active) { stroke = '#ECF0F3'; fill = hue === null ? '#ECF0F3' : hsl(hue, 50, 55); }
        else if (sel) fill = hue === null ? 'rgba(156,171,194,.35)' : hsl(hue, 50, 55);
        build('hue', () => hue === null ? [svg('circle', { cx: c[0], cy: c[1], r: 6, fill: 'none', stroke: '#000', 'stroke-width': 2 })] : []);
        opacity = 1; tip = hue === null ? 'No hue' : `Hue ${hue}°`;
      }
      seg.path.setAttribute('fill', fill); seg.path.setAttribute('stroke', stroke);
      seg.g.setAttribute('data-tip', tip); seg.g.style.cursor = dragging === r.key ? 'grabbing' : 'pointer';
      seg.content.style.opacity = String(opacity);
      seg.content.style.transform = `rotate(${-rot[r.key]}deg)`;
      seg.content.style.transition = dragging === r.key ? 'opacity 280ms' : 'transform 560ms cubic-bezier(.2,0,.2,1), opacity 280ms';
    });
  }
  function thumb(comp: CompId, ratio: RatioId, guide: GuideId, cx: number, cy: number, ink: string): SVGElement {
    const cs = canvasSize(ratio), k = 42 / Math.max(cs.w, cs.h), w = cs.w * k, hh = cs.h * k, x0 = cx - w / 2, y0 = cy - hh / 2, g = svg('g');
    const l = layout({ canvas: cs, guide, comp, measure, headline: 'Headline', body: 'Body text' });
    const rect = (x: number, y: number, rw: number, rh: number, attrs: Record<string, string | number>) => g.append(svg('rect', { x: x0 + x * k, y: y0 + y * k, width: Math.max(.5, rw * k), height: Math.max(.5, rh * k), ...attrs }));
    rect(0, 0, cs.w, cs.h, { fill: 'none', stroke: ink, 'stroke-width': 1.5 });
    for (const f of fractionsOf(guide)) { g.append(svg('line', { x1: x0 + f * w, y1: y0, x2: x0 + f * w, y2: y0 + hh, stroke: ink, 'stroke-opacity': .3 }), svg('line', { x1: x0, y1: y0 + f * hh, x2: x0 + w, y2: y0 + f * hh, stroke: ink, 'stroke-opacity': .3 })); }
    if (l.image) rect(l.image.x, l.image.y, l.image.w, l.image.h, { fill: ink, 'fill-opacity': .2, stroke: ink, 'stroke-width': 1 });
    rect(l.accent.x, l.accent.y, l.accent.w, l.accent.h, { fill: ink });
    rect(l.headline.rect.x, l.headline.rect.y + l.headline.fontSize * .15, Math.min(l.headline.rect.w, l.headline.fontSize * 4.2), l.headline.fontSize * .78, { fill: ink });
    rect(l.body.rect.x, l.body.rect.y + l.body.fontSize * .3, Math.min(l.body.rect.w, l.body.fontSize * 5), Math.max(3 / k, l.body.fontSize * .4), { fill: ink, 'fill-opacity': .6 });
    return g;
  }
  function paint(): void {
    const s = host.settings(), vw = window.innerWidth, vh = window.innerHeight;
    const ds = Math.max(.5, Math.min(1, (vh - 190) / 640, (vw - 660) / 640));
    wheelBox.style.transform = `scale(${ds})`; wheelBox.style.top = `${Math.max(40, (vh - 110 - 640 * ds) / 2 + 10)}px`;
    RINGS.forEach((r, ri) => {
      const g = ringEls[ri];
      g.style.transform = `rotate(${rot[r.key]}deg)`;
      g.style.transition = dragging === r.key ? 'none' : 'transform 560ms cubic-bezier(.2,0,.2,1)';
      updateSegments(ri);
    });
    hueWindow.style.opacity = focus === 3 ? '1' : '.15';
    // readout
    const r = ratioById(s.ratio), e = exportSize(s.ratio, r.mm ? { dpi: 300 } : { scale: 1 }), F = fractionsOf(s.guide);
    const doc = host.preview(hoverRatio ? { ...s, ratio: hoverRatio } : s), p = doc.palette;
    const values: [string, string, string][] = [
      ['Ratio', `${r.label} ${ratioNumbers(s.ratio)}`, `Exports at ${e.w} × ${e.h} px${r.mm ? ' (300 dpi)' : ''}`],
      ['Layout', COMP_NAMES[s.comp], describe(s.comp, s.guide)],
      ['Guide', guideById(s.guide).name, `Lines at ${F.map(pct).join(', ')}%`],
      ['Colour', s.accent ? `Custom ${s.accent.toUpperCase()}` : s.hue === null ? 'No hue' : `Hue ${s.hue}°`, s.dark ? 'Dark ground' : 'Light ground'],
    ];
    cards.forEach((c, i) => {
      c.classList.toggle('focus', focus === i || hoverRing === i);
      c.children[0].textContent = values[i][0]; c.children[2].textContent = values[i][2];
      const v = c.children[1] as HTMLElement; v.replaceChildren(h('span', { style: 'margin-right:4px' }, values[i][1]));
      if (i === 3) for (const role of ['ground', 'ink', 'accent'] as const) v.append(h('span', { className: 'dot', style: `background:${resolve({ role }, p)}` }));
    });
    light.setAttribute('aria-pressed', String(!s.dark)); dark.setAttribute('aria-pressed', String(s.dark));
    const accent = resolve({ role: 'accent' }, p);
    anyChip.style.background = accent; anyHex.textContent = accent.toUpperCase();
    if (!s.accent) pickHsv = hexToHsv(accent);
    sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,${hsvToHex(pickHsv.h, 100, 100)})`;
    const dot = sv.firstElementChild as HTMLElement; dot.style.left = `${pickHsv.s}%`; dot.style.top = `${100 - pickHsv.v}%`; dot.style.background = accent;
    (hueBar.firstElementChild as HTMLElement).style.left = `${pickHsv.h / 3.59}%`;
    const has = host.hasDoc();
    startLabel.textContent = has ? 'Go' : 'Start'; start.title = has ? 'Go (Enter)' : 'Start (Enter)'; hub.title = start.title;
    fresh.classList.toggle('hidden', !has); back.classList.toggle('hidden', !has);
    // hub preview: the canvas you get, at 120 px
    {
      const cs = canvasSize(doc.sizes[0].ratio), k = 120 / Math.max(cs.w, cs.h), dpr = window.devicePixelRatio || 1;
      new Canvas2DRenderer(hubCanvas).render(doc, { sizeId: doc.sizes[0].id, scale: k * dpr, measure, image: host.image, placeholders: true });
      Object.assign(hubCanvas.style, { width: `${cs.w * k}px`, height: `${cs.h * k}px`, left: `${106 - cs.w * k / 2}px`, top: `${92 - cs.h * k / 2}px`, transition: 'width 480ms, height 480ms, left 480ms, top 480ms' });
    }
  }
  paint();
  requestAnimationFrame(() => { for (const r of RINGS) rot[r.key] = rotationFor(rot[r.key], index(r.key), r.n); paint(); });
  return { paint, destroy() { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); } };
}
