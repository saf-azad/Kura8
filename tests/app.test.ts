import { describe, it, expect } from 'vitest';
import { resizeLocal } from '../src/app/canvas/resize';
import { bezier, ease, lerpFrame, lerpDoc } from '../src/app/canvas/tween';
import { modCommand, nudgeStep, isMac, primaryModifier, shortcutLabel } from '../src/app/tools/shortcuts';
import { doc, frame, rectNode } from './helpers';
const box = { x: 100, y: 200, w: 300, h: 200 }, min = { w: 20, h: 20 };
describe('resize in the node frame', () => {
  it('keeps the opposite corner fixed and clamps to the minimum before crossing', () => {
    expect(resizeLocal(box, 0, 'se', { x: 500, y: 500 }, { lockAspect: false, min }).rect).toEqual({ x: 100, y: 200, w: 400, h: 300 });
    expect(resizeLocal(box, 0, 'nw', { x: 1000, y: 1000 }, { lockAspect: false, min }).rect).toEqual({ x: 380, y: 380, w: 20, h: 20 });
    expect(resizeLocal(box, 0, 'e', { x: 450, y: 9 }, { lockAspect: false, min }).rect).toEqual({ x: 100, y: 200, w: 350, h: 200 });
  });
  it('locks aspect on corners and reports the dominant axis', () => {
    const r = resizeLocal(box, 0, 'se', { x: 700, y: 410 }, { lockAspect: true, min });
    expect(r.rect.w / r.rect.h).toBeCloseTo(1.5); expect(r.rect.w).toBeCloseTo(600); expect(r.dominantAxis).toBe('x');
    expect(resizeLocal(box, 0, 'se', { x: 410, y: 700 }, { lockAspect: true, min }).dominantAxis).toBe('y');
  });
  it('resizes rotated boxes along their own axes with the far edge pinned', () => {
    const r = resizeLocal(box, 90, 'e', { x: 250, y: 600 }, { lockAspect: false, min });
    expect(r.rect.w).toBeCloseTo(450); expect(r.rect.h).toBeCloseTo(200);
    const west = { x: r.rect.x + r.rect.w / 2, y: r.rect.y + r.rect.h / 2 - r.rect.w / 2 };
    expect(west.x).toBeCloseTo(250); expect(west.y).toBeCloseTo(150);
  });
});
describe('tween', () => {
  it('eases on cubic-bezier(.2,0,.2,1) and interpolates frames the short way round', () => {
    expect(ease(0)).toBe(0); expect(ease(1)).toBe(1); expect(ease(.5)).toBeGreaterThan(.5); expect(bezier(0, 0, 1, 1)(.3)).toBeCloseTo(.3, 3);
    const f = lerpFrame(frame(0, 0, 10, 10, { rot: 350, fontSize: 10 }), frame(10, 20, 20, 30, { rot: 10, fontSize: 20 }), .5);
    expect(f.rect).toEqual({ x: 5, y: 10, w: 15, h: 20 }); expect(f.rot).toBeCloseTo(360); expect(f.fontSize).toBe(15);
    const a = doc([rectNode('a', frame(0, 0, 10, 10))]), b = doc([rectNode('a', frame(100, 0, 10, 10)), rectNode('b', frame(5, 5, 5, 5))]);
    const mid = lerpDoc(a, b, 'main', .5); expect(mid.nodes[0].frames.main.rect.x).toBe(50); expect(mid.nodes[1]).toBe(b.nodes[1]);
  });
});
describe('keyboard map', () => {
  it('maps Mod combinations Kura8 owns and nothing else', () => {
    const k = (key: string, extra: Partial<{ shiftKey: boolean; altKey: boolean; code: string }> = {}) => modCommand({ key, code: extra.code ?? `Key${key.toUpperCase()}`, shiftKey: !!extra.shiftKey, altKey: !!extra.altKey });
    expect(['c', 'x', 'd', 'a', 'z', 'y', 'b'].map(x => k(x))).toEqual(['copy', 'cut', 'duplicate', 'selectAll', 'undo', 'redo', 'bold']);
    expect([k('z', { shiftKey: true }), k('L', { shiftKey: true }), k('E', { shiftKey: true })]).toEqual(['redo', 'lock', 'export']);
    expect([k(']', { code: 'BracketRight' }), k('}', { code: 'BracketRight', shiftKey: true }), k('[', { code: 'BracketLeft' }), k('{', { code: 'BracketLeft', shiftKey: true })]).toEqual(['forward', 'front', 'backward', 'back']);
    expect([k('l'), k('e'), k('r'), k('v'), k('d', { altKey: true }), k('t', { shiftKey: true })]).toEqual([null, null, null, null, null, null]);
  });
  it('nudges one unit, or one grid cell with Shift when the grid is on (5l)', () => {
    expect([nudgeStep(false, { on: true, size: 40 }), nudgeStep(true, { on: true, size: 40 }), nudgeStep(true, { on: false, size: 40 })]).toEqual([1, 40, 10]);
  });
  it('uses Command only on Apple platforms and Control only on PCs', () => {
    for (const platform of ['MacIntel', 'iPad', 'iPhone']) expect(isMac(platform)).toBe(true);
    for (const platform of ['Win32', 'Linux x86_64']) expect(isMac(platform)).toBe(false);
    expect(primaryModifier({ metaKey: true, ctrlKey: false }, true)).toBe(true);
    expect(primaryModifier({ metaKey: false, ctrlKey: true }, false)).toBe(true);
    expect(primaryModifier({ metaKey: false, ctrlKey: true }, true)).toBe(false);
    expect(primaryModifier({ metaKey: true, ctrlKey: true }, true)).toBe(false);
    expect(shortcutLabel('Mod+Shift+L', true)).toBe('⌘+⇧+L'); expect(shortcutLabel('Mod+Shift+L', false)).toBe('Ctrl+Shift+L');
  });
});
