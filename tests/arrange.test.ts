import { describe, it, expect } from 'vitest';
import { align, distribute, unitsOf, offsetFrames, withGroups, groupNodes, ungroupNodes, fillPage } from '../src/core/arrange';
import { cloneNodes } from '../src/core/ops';
import { doc, frame, rectNode, ids } from './helpers';
const page = { w: 1000, h: 800 };
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
describe('align and distribute (D-045)', () => {
  it('collapses groups into units with a shared bounding box', () => {
    const u = unitsOf([{ id: 'a', box: box(0, 0, 10, 10) }, { id: 'b', group: 'g', box: box(100, 0, 10, 10) }, { id: 'c', group: 'g', box: box(200, 50, 10, 10) }]);
    expect(u).toEqual([{ ids: ['a'], box: box(0, 0, 10, 10) }, { ids: ['b', 'c'], box: box(100, 0, 110, 60) }]);
  });
  it('aligns one unit to the page and several to their shared bounds', () => {
    const one = [{ ids: ['a'], box: box(100, 100, 200, 100) }];
    expect(align(one, 'left', page)).toEqual({ a: { x: -100, y: 0 } }); expect(align(one, 'centre', page)).toEqual({ a: { x: 300, y: 0 } });
    expect(align(one, 'right', page)).toEqual({ a: { x: 700, y: 0 } }); expect(align(one, 'top', page)).toEqual({ a: { x: 0, y: -100 } });
    expect(align(one, 'middle', page)).toEqual({ a: { x: 0, y: 250 } }); expect(align(one, 'bottom', page)).toEqual({ a: { x: 0, y: 600 } });
    const two = [{ ids: ['a'], box: box(100, 100, 100, 100) }, { ids: ['b', 'c'], box: box(400, 300, 50, 50) }];
    expect(align(two, 'right', page)).toEqual({ a: { x: 250, y: 0 }, b: { x: 0, y: 0 }, c: { x: 0, y: 0 } });
    expect(align(two, 'top', page)).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: -200 }, c: { x: 0, y: -200 } });
  });
  it('spaces three or more units evenly between the outermost two', () => {
    const u = [{ ids: ['c'], box: box(600, 0, 100, 10) }, { ids: ['a'], box: box(0, 0, 100, 10) }, { ids: ['b'], box: box(150, 0, 50, 10) }];
    expect(distribute(u, 'x')).toEqual({ a: { x: 0, y: 0 }, b: { x: 175, y: 0 }, c: { x: 0, y: 0 } });
    const v = [{ ids: ['a'], box: box(0, 0, 10, 10) }, { ids: ['b'], box: box(0, 10, 10, 10) }, { ids: ['c'], box: box(0, 100, 10, 10) }];
    expect(distribute(v, 'y').b).toEqual({ x: 0, y: 40 });
    expect(distribute(u.slice(0, 2), 'x')).toEqual({});
    const tie = [{ ids: ['a'], box: box(0, 0, 50, 10) }, { ids: ['b'], box: box(0, 0, 10, 10) }, { ids: ['c'], box: box(100, 0, 10, 10) }];
    expect(Object.keys(distribute(tie, 'x'))).toEqual(['b', 'a', 'c']);
  });
  it('offsets unlocked frames only and skips zero moves', () => {
    const d = doc([rectNode('a', frame(0, 0, 10, 10)), rectNode('b', frame(0, 0, 10, 10), { locked: true })]);
    const out = offsetFrames(d, 'main', { a: { x: 5, y: 6 }, b: { x: 5, y: 5 } });
    expect(out.nodes[0].frames.main.rect).toMatchObject({ x: 5, y: 6 }); expect(out.nodes[1]).toBe(d.nodes[1]);
    expect(offsetFrames(d, 'main', { a: { x: 0, y: 0 } }).nodes[0]).toBe(d.nodes[0]);
  });
});
describe('groups and fill page (D-045)', () => {
  const d = doc([rectNode('a', frame(0, 0, 10, 10)), rectNode('b', frame(20, 0, 10, 10)), rectNode('c', frame(40, 0, 10, 10), { locked: true })]);
  it('groups, expands and ungroups', () => {
    expect(groupNodes(d, ['a'], 'g')).toBe(d);
    const g = groupNodes(d, ['a', 'c'], 'g');
    expect(g.nodes.map(n => n.group)).toEqual(['g', undefined, 'g']);
    expect(withGroups(g, ['c'])).toEqual(['a', 'c']); expect(withGroups(g, ['b'])).toEqual(['b']);
    const u = ungroupNodes(g, ['a']); expect(u.nodes.every(n => !('group' in n))).toBe(true); expect(u.nodes[1]).toBe(g.nodes[1]);
  });
  it('copies of a whole group form a new group; a lone copied member leaves it', () => {
    const g = groupNodes(d, ['a', 'b'], 'g'), next = ids();
    const both = cloneNodes(g, g.nodes.slice(0, 2), next, 20); expect(both[0].group).toBe(both[1].group); expect(both[0].group).not.toBe('g');
    expect('group' in cloneNodes(g, [g.nodes[0]], next, 20)[0]).toBe(false);
  });
  it('fills the page with an unlocked node and sends it to the back', () => {
    const out = fillPage({ ...d, nodes: [...d.nodes.slice(0, 2), { ...d.nodes[2], locked: undefined }] }, 'main', 'c', page);
    expect(out.nodes[0].id).toBe('c'); expect(out.nodes[0].frames.main).toEqual({ rect: { x: 0, y: 0, w: 1000, h: 800 }, rot: 0 });
    expect(fillPage(d, 'main', 'c', page)).toBe(d); expect(fillPage(d, 'main', 'zz', page)).toBe(d);
  });
});
