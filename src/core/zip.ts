// A store-only ZIP writer (D-067) for "All sizes" exports: no compression (PNG, JPG and PDF are compressed
// already), UTF-8 names, fixed 1980-01-01 timestamps so the same files give the same bytes.
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** Names made unique by a -2, -3 … before the extension, so two sizes of one ratio both survive unzipping. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map(n => { const k = (seen.get(n) ?? 0) + 1; seen.set(n, k); return k === 1 ? n : n.replace(/(\.[^.]*)?$/, m => `-${k}${m}`); });
}
export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  const header = (size: number, write: (v: DataView) => void) => { const b = new Uint8Array(size); write(new DataView(b.buffer)); return b; };
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const common = (v: DataView, at: number) => { v.setUint16(at, 20, true); v.setUint16(at + 2, 0x0800, true); v.setUint16(at + 4, 0, true); v.setUint16(at + 6, 0, true); v.setUint16(at + 8, 0x21, true); v.setUint32(at + 10, crc, true); v.setUint32(at + 14, n, true); v.setUint32(at + 18, n, true); v.setUint16(at + 22, name.length, true); };
    const local = header(30, v => { v.setUint32(0, 0x04034b50, true); common(v, 4); });
    central.push(header(46, v => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); common(v, 6); v.setUint32(42, offset, true); }), name);
    parts.push(local, name, f.data); offset += 30 + name.length + n;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = header(22, v => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, size, true); v.setUint32(16, offset, true); });
  const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, b) => s + b.length, 0));
  let at = 0;
  for (const b of all) { out.set(b, at); at += b.length; }
  return out;
}
