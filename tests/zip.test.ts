import { it, expect } from 'vitest';
import { crc32, zip } from '../src/core/zip';
it('computes the standard CRC-32', () => {
  expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686); expect(crc32(new Uint8Array())).toBe(0);
});
it('writes a store-only zip that lists every file (D-067)', () => {
  const files = [{ name: 'post-square.png', data: new Uint8Array([1, 2, 3]) }, { name: 'café-story.png', data: new TextEncoder().encode('hello') }];
  const out = zip(files), v = new DataView(out.buffer);
  expect(v.getUint32(0, true)).toBe(0x04034b50);
  const end = out.length - 22; expect(v.getUint32(end, true)).toBe(0x06054b50); expect(v.getUint16(end + 10, true)).toBe(2);
  let at = v.getUint32(end + 16, true);
  const names: string[] = [];
  for (let i = 0; i < 2; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const len = v.getUint16(at + 28, true), local = v.getUint32(at + 42, true);
    names.push(new TextDecoder().decode(out.slice(at + 46, at + 46 + len)));
    const size = v.getUint32(local + 18, true), nameLen = v.getUint16(local + 26, true);
    expect(Array.from(out.slice(local + 30 + nameLen, local + 30 + nameLen + size))).toEqual(Array.from(files[i].data));
    expect(v.getUint32(local + 14, true)).toBe(crc32(files[i].data));
    at += 46 + len;
  }
  expect(names).toEqual(['post-square.png', 'café-story.png']);
  expect(zip(files)).toEqual(out);
});
