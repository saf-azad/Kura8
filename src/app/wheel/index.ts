import { ratios } from '../../core/ratios';
import { guides } from '../../core/guides';
import type { RatioId } from '../../core/document';
import type { GuideId } from '../../core/guides/types';
const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value)); return el;
}
function polar(r: number, a: number): [number, number] { return [300 + r * Math.cos(a), 300 + r * Math.sin(a)]; }
function wedge(start: number, end: number): string {
  const a = polar(262, start), b = polar(262, end), c = polar(85, end), d = polar(85, start);
  return `M${a} A262,262 0 0 1 ${b} L${c} A85,85 0 0 0 ${d} Z`;
}
export function showWheel(host: HTMLElement, onChoose: (ratio: RatioId, guide: GuideId) => void): void {
  let ratio: RatioId = 'square';
  const render = (stage: 'ratio' | 'guide') => {
    host.replaceChildren(); host.className = 'wheel-stage';
    const wheel = svg('svg', { viewBox: '0 0 600 600', class: 'wheel', 'aria-label': stage === 'ratio' ? 'Choose ratio' : 'Choose guide' });
    const items = stage === 'ratio' ? ratios : guides;
    items.forEach((item, i) => {
      const middle = -Math.PI / 2 + i * Math.PI * 2 / items.length;
      const half = Math.PI / items.length, start = middle - half, end = middle + half;
      const group = svg('g', { class: 'wheel-option', role: 'button', tabindex: 0, 'aria-label': item.name });
      const choose = () => { if (stage === 'ratio') { ratio = item.id as RatioId; render('guide'); } else onChoose(ratio, item.id as GuideId); };
      group.onclick = choose; group.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
      group.append(svg('path', { d: wedge(start, end), class: 'sector' }));
      const [cx, cy] = polar(179, middle), glyph = svg('g', { transform: `translate(${cx},${cy - 18})`, class: 'wheel-glyph' });
      if (stage === 'ratio') {
        const r = ratios[i], s = 47 / Math.max(r.w, r.h), w = r.w * s, h = r.h * s;
        glyph.append(svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h }));
        const label = svg('text', { x: cx, y: cy + 38, 'text-anchor': 'middle' }); label.textContent = `${r.w}:${r.h}`; group.append(label);
        const name = svg('text', { x: cx, y: cy + 58, class: 'ratio-name', 'text-anchor': 'middle' }); name.textContent = r.name; group.append(name);
      } else {
        glyph.append(svg('rect', { x: -27, y: -27, width: 54, height: 54 }));
        const anchors = guides[i].generate({ w: 54, h: 54 });
        for (const a of anchors) if (a.kind === 'line') glyph.append(svg('line', { x1: a.axis === 'x' ? a.at - 27 : -27, y1: a.axis === 'y' ? a.at - 27 : -27, x2: a.axis === 'x' ? a.at - 27 : 27, y2: a.axis === 'y' ? a.at - 27 : 27 }));
        const label = svg('text', { x: cx, y: cy + 40, 'text-anchor': 'middle' }); label.textContent = item.name; group.append(label);
      }
      group.append(glyph); wheel.append(group);
    });
    const centre = svg('g', { class: stage === 'ratio' ? 'wheel-centre' : 'wheel-core', ...(stage === 'ratio' ? { role: 'button', tabindex: 0, 'aria-label': 'Use square ratio' } : {}) });
    centre.append(svg('circle', { cx: 300, cy: 300, r: 85 }));
    if (stage === 'ratio') {
      centre.append(svg('path', { d: 'M282 300H318M309 291L318 300L309 309', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }));
      const choose = () => render('guide'); centre.onclick = choose; centre.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } };
    } else {
      const r = ratios.find(r => r.id === ratio)!; const text = svg('text', { x: 300, y: 306, 'text-anchor': 'middle' }); text.textContent = `${r.w}:${r.h}`; centre.append(text);
    }
    wheel.append(centre); host.append(wheel);
    const footer = document.createElement('div'); footer.className = 'wheel-caption'; footer.textContent = stage === 'ratio' ? '01 / RATIO' : '02 / GUIDE'; host.append(footer);
  };
  render('ratio');
}
