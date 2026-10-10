// Bakes the Phosphor fill icons (@phosphor-icons/core, MIT, devDependency) into gitignored public/icons/ so the icon
// library never leaves the app's origin (runs before `npm run dev` and `npm run build`):
//   index.json        { version, set, licence, source, categories, picks, icons: [name, categoryIndex, tagWords][] }
//   paths-<k>.json    { [name]: [d, flattened 0|1] } per chunkOf(name), d normalised to a 100 × 100 box, loaded lazily
//   LICENSE.txt       the Phosphor licence, shipped next to the icons
// scalePath, flattenSvg and chunkOf mirror src/core/icons.ts (plain Node cannot import TypeScript; tests/icons.test.ts
// checks the two agree). Skips with a log line when index.json already holds this version and icon count.
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { icons as catalog, FigmaCategory } from '@phosphor-icons/core';
const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = path.join(root, 'node_modules/@phosphor-icons/core'), fill = path.join(pkg, 'assets/fill'), out = path.join(root, 'public/icons');
const SOURCE = 'https://github.com/phosphor-icons/core';
// The prototype's default picks (Kura8 Prototype.dc.html, ICON_PICKS); names missing from the set are dropped.
const PICKS = ['heart', 'star', 'house', 'user', 'chat-circle', 'bell', 'camera', 'music-note', 'sun', 'moon', 'cloud', 'lightning', 'leaf', 'flower', 'tree', 'fire', 'drop', 'snowflake', 'map-pin', 'globe', 'airplane', 'car', 'bicycle', 'rocket', 'coffee', 'pizza', 'cake', 'gift', 'shopping-bag', 'tag', 'ticket', 'crown', 'trophy', 'medal', 'smiley', 'hand-heart', 'thumbs-up', 'check-circle', 'x-circle', 'plus-circle', 'info', 'warning', 'question', 'lock', 'key', 'envelope', 'phone', 'calendar', 'clock', 'bookmark', 'book-open', 'pencil', 'paint-brush', 'palette', 'scissors', 'lightbulb', 'magnifying-glass', 'play', 'pause', 'film-strip', 'headphones', 'microphone', 'paw-print', 'butterfly'];

// --- mirrored from src/core/icons.ts ---
const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const TOKEN = new RegExp(`[a-zA-Z]|${NUMBER.source}`, 'g');
export function scalePath(d, k) {
  const re = new RegExp(TOKEN);
  let out = '', arc = false, n = 0, number = false;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    let v = m[0];
    if (/^[a-z]/i.test(v)) { arc = v === 'a' || v === 'A'; n = 0; number = false; out += v; continue; }
    const j = arc ? n % 7 : -1; n++;
    if (j === 3 || j === 4) { v = v[0]; re.lastIndex = m.index + 1; }
    else if (j !== 2) v = String(+(+v * k).toFixed(2));
    out += (number && v[0] !== '-' ? ' ' : '') + v; number = true;
  }
  return out;
}
const absolute = d => d.replace(/^m([^a-df-z]*)/i, (_, a) => { const [x, y, ...rest] = a.match(NUMBER) ?? []; return rest.length ? `M${x} ${y}l${rest.join(' ')}` : 'M' + a; });
export function flattenSvg(svg) {
  const ds = (svg.match(/<path\b[^>]*>/g) ?? []).map(t => /\sd\s*=\s*(["'])([^]*?)\1/.exec(t)?.[2].trim() ?? '').filter(Boolean);
  return { d: ds.map(absolute).join(' '), flattened: ds.length > 1 || /opacity\s*[=:]/i.test(svg) };
}
export const chunkOf = name => { const c = name.charAt(0).toLowerCase(); return c >= 'a' && c <= 'z' ? c : '0'; };
// --- end mirror ---

const fold = s => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
const stem = w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w; // as in src/core/icons.ts
const wordsOf = entry => [...entry.tags, ...(entry.alias ? [entry.alias.name] : [])].filter(t => !/^\*.*\*$/.test(t)).flatMap(t => fold(t).split(/[^\p{L}\p{N}]+/u)).filter(Boolean);
/** Words on more than this many icons carry no search signal ("directional", "pointer" on every arrow) and are dropped. */
const COMMON = 100;
/**
 * Tag words for search, deduplicated: without meta tags ("*new*", "*updated*"), alias names included, and without words
 * searchIcons already reaches another way: words a name word starts with, plurals of a kept word (it stems queries), and
 * words in `common`.
 */
export function tagWords(entry, common = new Set()) {
  const own = entry.name.split('-'), words = new Set(wordsOf(entry));
  return [...words].filter(w => !own.some(x => x.startsWith(w)) && !common.has(w) && !(stem(w) !== w && (words.has(stem(w)) || own.includes(stem(w))))).join(' ');
}
const FORMAT = 1; // bump when the baked layout or tag rules change, so existing bakes are redone
async function main() {
  const version = JSON.parse(await readFile(path.join(pkg, 'package.json'), 'utf8')).version;
  const files = new Set((await readdir(fill)).filter(f => f.endsWith('-fill.svg')).map(f => f.slice(0, -'-fill.svg'.length)));
  const entries = catalog.filter(e => files.has(e.name)).sort((a, b) => (a.name < b.name ? -1 : 1));
  const indexPath = path.join(out, 'index.json');
  if (existsSync(indexPath)) {
    const old = JSON.parse(await readFile(indexPath, 'utf8'));
    const chunks = new Set(entries.map(e => chunkOf(e.name)));
    if (old.format === FORMAT && old.version === version && old.icons?.length === entries.length && existsSync(path.join(out, 'LICENSE.txt')) && [...chunks].every(k => existsSync(path.join(out, `paths-${k}.json`)))) {
      console.log(`icons: phosphor ${version}, ${entries.length} fill icons in public/icons (up to date)`); return;
    }
  }
  const categories = Object.values(FigmaCategory), chunks = {};
  let flattened = 0;
  for (const e of entries) {
    const svg = await readFile(path.join(fill, `${e.name}-fill.svg`), 'utf8');
    const box = Number(/viewBox\s*=\s*["']([^"']+)/.exec(svg)?.[1].trim().split(/[\s,]+/)[2] ?? 256), flat = flattenSvg(svg);
    if (!flat.d) throw new Error(`icons: ${e.name}-fill.svg has no path data`);
    (chunks[chunkOf(e.name)] ??= {})[e.name] = [scalePath(flat.d, 100 / box), flat.flattened ? 1 : 0];
    flattened += flat.flattened ? 1 : 0;
  }
  const names = new Set(entries.map(e => e.name)), picks = PICKS.filter(p => names.has(p));
  const counts = new Map();
  for (const e of entries) for (const w of new Set(wordsOf(e))) counts.set(w, (counts.get(w) ?? 0) + 1);
  const common = new Set([...counts].filter(([, n]) => n > COMMON).map(([w]) => w));
  const index = { format: FORMAT, version, set: 'phosphor', licence: 'MIT', source: SOURCE, categories, picks, icons: entries.map(e => [e.name, categories.indexOf(e.figma_category), tagWords(e, common)]) };
  if (index.icons.some(i => i[1] < 0)) throw new Error('icons: unknown figma_category in the catalog');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [k, chunk] of Object.entries(chunks)) await writeFile(path.join(out, `paths-${k}.json`), JSON.stringify(chunk));
  await copyFile(path.join(pkg, 'LICENSE'), path.join(out, 'LICENSE.txt'));
  const json = JSON.stringify(index);
  await writeFile(indexPath, json); // written last: its presence marks a complete bake
  console.log(`icons: phosphor ${version}, ${entries.length} fill icons (${flattened} flattened) written to public/icons: index ${(json.length / 1024).toFixed(1)} KB, ${Object.keys(chunks).length} path chunks; dropped common tags: ${[...common].join(', ') || 'none'}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
