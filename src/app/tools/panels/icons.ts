import { searchIcons, type IconIndex } from '../../../core/icons';
// The baked Phosphor index and lazily loaded path chunks, served from this app's own origin (scripts/prepare-icons.mjs).
const base = import.meta.env.BASE_URL;
let index: Promise<IconIndex | null> | undefined;
const chunks = new Map<string, Promise<Record<string, [string, number]>>>();
export const loadIndex = (): Promise<IconIndex | null> => index ??= fetch(`${base}icons/index.json`).then(r => r.ok ? r.json() as Promise<IconIndex> : null).catch(() => { index = undefined; return null; });
const chunkOf = (name: string) => { const c = name.charAt(0).toLowerCase(); return c >= 'a' && c <= 'z' ? c : '0'; };
export async function iconPath(name: string): Promise<{ d: string; flattened: boolean } | null> {
  const k = chunkOf(name);
  let p = chunks.get(k);
  if (!p) { p = fetch(`${base}icons/paths-${k}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({})); chunks.set(k, p); }
  const entry = (await p)[name];
  return entry ? { d: entry[0], flattened: entry[1] === 1 } : null;
}
export async function findIcons(q: string): Promise<{ names: string[]; category?: string } | null> {
  const i = await loadIndex();
  return i ? searchIcons(i, q, undefined, 48) : null;
}
