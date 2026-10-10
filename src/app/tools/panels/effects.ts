import type { ColourRef, DocNode, Role } from '../../../core/document';
import type { Editor } from '../../editor';
import { h, iconButton, ICON, slider, textButton, MOD, ALT } from '../../ui';
// Effects (D-045): transparency, drop shadow and border for anything selected, mirroring, and copy/paste style.
// Shadow and border colours are palette roles, so they follow hue and dark mode like every other colour.
const ROLES: [Role, string][] = [['ink', 'Ink'], ['accent', 'Accent'], ['ground', 'Ground']];
const deg = (r: number) => (r * 180 / Math.PI + 360) % 360;
export function effectsPanel(ed: Editor): HTMLElement {
  const sel = () => ed.selected().filter(n => !n.locked), first = (): DocNode | undefined => sel()[0];
  const opacity = slider('Opacity', { min: 0, max: 100, step: 1, format: v => `${Math.round(v)} %`, set: v => ed.setOpacity(v / 100) });
  const sw = (label: string, go: () => void) => { const b = h('button', { type: 'button', className: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label, title: label }); b.addEventListener('click', go); return b; };
  const shadowSwitch = sw('Shadow', () => ed.toggleShadow()), borderSwitch = sw('Border', () => ed.toggleOutline());
  const polar = () => { const s = first()?.shadow; return s ? { d: Math.hypot(s.x, s.y), a: deg(Math.atan2(s.y, s.x)) } : { d: 0, a: 45 }; };
  const blur = slider('Shadow blur', { min: 0, max: 100, step: 1, set: v => ed.setShadow({ blur: v }) });
  const distance = slider('Shadow distance', { min: 0, max: 100, step: 1, set: v => { const a = polar().a * Math.PI / 180; ed.setShadow({ x: v * Math.cos(a), y: v * Math.sin(a) }); } });
  const angle = slider('Shadow angle', { min: 0, max: 359, step: 1, format: v => `${Math.round(v)}°`, set: v => { const d = polar().d, a = v * Math.PI / 180; ed.setShadow({ x: d * Math.cos(a), y: d * Math.sin(a) }); } });
  const strength = slider('Shadow strength', { min: 0, max: 100, step: 1, format: v => `${Math.round(v)} %`, set: v => ed.setShadow({ alpha: v / 100 }) });
  const width = slider('Border width', { min: 1, max: 40, step: 1, set: v => ed.setOutline({ width: v }) });
  const roleDots = (what: 'shadow' | 'border') => ROLES.map(([role, name]) => {
    const b = h('button', { type: 'button', className: 'dot-button', 'aria-label': `${what === 'shadow' ? 'Shadow' : 'Border'} colour ${name}`, title: name });
    b.addEventListener('click', () => { const fill: ColourRef = { role }; if (what === 'shadow') ed.setShadow({ fill }); else ed.setOutline({ fill }); });
    return { role, b };
  });
  const shadowDots = roleDots('shadow'), borderDots = roleDots('border');
  const shadowBox = h('div', { className: 'sub' }, blur.el, distance.el, angle.el, strength.el, h('div', { className: 'dots' }, h('span', { className: 'muted' }, 'Colour'), ...shadowDots.map(d => d.b)));
  const borderBox = h('div', { className: 'sub' }, width.el, h('div', { className: 'dots' }, h('span', { className: 'muted' }, 'Colour'), ...borderDots.map(d => d.b)));
  const flips = h('div', { className: 'actions' }, iconButton('Flip horizontal', ICON.flipX, () => ed.flip('x')), iconButton('Flip vertical', ICON.flipY, () => ed.flip('y')));
  const style = h('div', { className: 'actions' }, textButton('Copy style', 'Copy style', () => ed.copyStyle(), `Copy style (${MOD} ${ALT} C)`), textButton('Paste style', 'Paste style', () => ed.pasteStyle(), `Paste style (${MOD} ${ALT} V)`));
  const panel = h('div', { className: 'panel effects-panel', hidden: true, role: 'dialog', 'aria-label': 'Effects' },
    opacity.el, h('div', { className: 'row' }, h('span', {}, 'Shadow'), shadowSwitch), shadowBox, h('div', { className: 'row' }, h('span', {}, 'Border'), borderSwitch), borderBox, flips, style);
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'effects', n = first(), all = sel();
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    panel.style.maxHeight = `${window.innerHeight - 120}px`;
    panel.classList.toggle('faded', !n);
    if (!n) return;
    opacity.show(Math.round((n.opacity ?? 1) * 100));
    const shadow = all.every(x => x.shadow), outlinable = all.flatMap(x => x.kind === 'ink' ? [] : [x]), border = outlinable.length > 0 && outlinable.every(x => x.outline);
    shadowSwitch.setAttribute('aria-checked', String(shadow)); borderSwitch.setAttribute('aria-checked', String(border));
    shadowBox.classList.toggle('hidden', !shadow); borderBox.classList.toggle('hidden', !border); borderSwitch.disabled = !outlinable.length;
    if (n.shadow) { const p = polar(); blur.show(n.shadow.blur); distance.show(p.d); angle.show(p.a); strength.show(n.shadow.alpha * 100); shadowDots.forEach(d => { d.b.style.background = ed.colour({ role: d.role }); d.b.setAttribute('aria-pressed', String('role' in n.shadow!.fill && n.shadow!.fill.role === d.role)); }); }
    const o = n.kind !== 'ink' ? n.outline : undefined;
    if (o) { width.show(o.width); borderDots.forEach(d => { d.b.style.background = ed.colour({ role: d.role }); d.b.setAttribute('aria-pressed', String('role' in o.fill && o.fill.role === d.role)); }); }
    flips.classList.toggle('faded', all.every(x => x.kind === 'text'));
  } });
  return panel;
}
