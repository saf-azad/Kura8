// Phosphor fill icons (5s–5u): path normalisation and the library search. The catalog is baked into public/icons/ by
// scripts/prepare-icons.mjs, which mirrors scalePath, flattenSvg and chunkOf (tests/icons.test.ts checks they agree).
/** The baked catalog: category names, the default picks, and per icon [name, category index, tag words joined by spaces]. */
export type IconIndex = { categories: string[]; picks: string[]; icons: [string, number, string][] };
export type IconResult = { names: string[]; category?: string };
const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const TOKEN = new RegExp(`[a-zA-Z]|${NUMBER.source}`, 'g');
/** Uniformly scales every coordinate of an SVG path by k (arc radii scale, arc rotation and flags do not), rounding to 2 decimals. */
export function scalePath(d: string, k: number): string {
  const re = new RegExp(TOKEN);
  let out = '', arc = false, n = 0, number = false;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    let v = m[0];
    if (/^[a-z]/i.test(v)) { arc = v === 'a' || v === 'A'; n = 0; number = false; out += v; continue; }
    const j = arc ? n % 7 : -1; n++;
    if (j === 3 || j === 4) { v = v[0]; re.lastIndex = m.index + 1; } // flags are one character and may be packed: "a8 8 0 018 8"
    else if (j !== 2) v = String(+(+v * k).toFixed(2));
    out += (number && v[0] !== '-' ? ' ' : '') + v; number = true;
  }
  return out;
}
/** A leading relative moveto is absolute for its first pair only; make that explicit so paths can be concatenated. */
const absolute = (d: string) => d.replace(/^m([^a-df-z]*)/i, (_, a: string) => { const [x, y, ...rest] = a.match(NUMBER) ?? []; return rest.length ? `M${x} ${y}l${rest.join(' ')}` : 'M' + a; });
/** Joins all <path d> of an icon SVG into one single-ink path; flattened = true when the source had several paths or fill/opacity variations (5t). */
export function flattenSvg(svg: string): { d: string; flattened: boolean } {
  const ds = (svg.match(/<path\b[^>]*>/g) ?? []).map(t => /\sd\s*=\s*(["'])([^]*?)\1/.exec(t)?.[2].trim() ?? '').filter(Boolean);
  return { d: ds.map(absolute).join(' '), flattened: ds.length > 1 || /opacity\s*[=:]/i.test(svg) };
}
/** The lazy path chunk an icon lives in (public/icons/paths-<k>.json): its first letter, or '0' for anything else. */
export const chunkOf = (name: string): string => { const c = name.charAt(0).toLowerCase(); return c >= 'a' && c <= 'z' ? c : '0'; };

/** Everyday words → icon vocabulary (names and tags of the Phosphor set). A key finds its words and each word finds its key. */
export const SYNONYMS: Record<string, string[]> = {
  // Student-test additions (D-051): words marketing and event students searched for.
  location: ['map pin', 'map trifold', 'navigation arrow'], venue: ['map pin', 'buildings'], place: ['map pin'], email: ['envelope', 'at'],
  mail: ['envelope'], contact: ['envelope', 'phone', 'address book'], social: ['share network', 'chat circle', 'heart'], hashtag: ['hash'],
  follow: ['user plus'], event: ['calendar', 'ticket'], date: ['calendar'], time: ['clock'], portfolio: ['briefcase', 'folder'],
  resume: ['file text', 'identification card'], cv: ['file text', 'identification card'], idea: ['lightbulb'], announcement: ['megaphone'],
  marketing: ['megaphone', 'chart line up', 'target'], analytics: ['chart bar', 'chart pie', 'chart line up'], engagement: ['heart', 'chat circle', 'share network'],
  university: ['graduation cap', 'student', 'bank'], uni: ['graduation cap', 'student'],
  coffee: ['cup', 'mug', 'café', 'cafe', 'espresso', 'latte'], tea: ['cup', 'mug', 'tea bag'], cocktail: ['martini', 'champagne'], alcohol: ['wine', 'beer bottle', 'martini'],
  eat: ['fork knife', 'bowl food', 'hamburger'], cook: ['cooking pot', 'chef hat', 'knife'], kitchen: ['cooking pot', 'fork knife', 'knife'],
  burger: ['hamburger'], sweet: ['cake', 'cookie', 'ice cream'], love: ['heart', 'hand heart'], like: ['heart', 'thumbs up'],
  favourite: ['heart', 'star', 'bookmark'], home: ['house', 'door'], inbox: ['tray', 'envelope'], smartphone: ['device mobile'],
  podcast: ['microphone', 'headphones', 'broadcast'], gallery: ['images', 'image square'], cinema: ['film strip', 'popcorn'],
  party: ['confetti', 'balloon', 'champagne', 'cake'], birthday: ['cake', 'gift', 'balloon', 'confetti'],
  celebrate: ['confetti', 'champagne', 'balloon'], christmas: ['tree evergreen', 'gift', 'snowflake'], halloween: ['ghost', 'skull'],
  cash: ['money', 'coins', 'currency dollar'], dollar: ['currency dollar', 'coin'],
  shop: ['shopping bag', 'shopping cart', 'storefront', 'basket', 'tag'], store: ['storefront', 'shopping bag'],
  sale: ['tag', 'percent', 'seal percent'], discount: ['percent', 'tag'], price: ['tag', 'currency dollar'], options: ['sliders', 'gear'],
  friends: ['users', 'handshake'], team: ['users three', 'users'], deadline: ['hourglass', 'timer', 'alarm'], notification: ['bell', 'bell ringing'],
  alert: ['warning', 'bell', 'siren'], danger: ['warning', 'skull'], ok: ['check', 'check circle'], done: ['check', 'check circle', 'checks'],
  yes: ['check', 'thumbs up'], close: ['x', 'x circle'], cancel: ['x', 'prohibit'], bin: ['trash', 'trash simple'],
  colour: ['palette', 'eyedropper', 'paint bucket'], address: ['map pin', 'house'], holiday: ['suitcase', 'island', 'tree palm', 'airplane'],
  vacation: ['suitcase', 'island', 'tree palm', 'umbrella'], flight: ['airplane', 'airplane takeoff'], ocean: ['waves', 'fish', 'anchor'],
  beach: ['island', 'tree palm', 'umbrella', 'sun'], weather: ['sun', 'cloud', 'cloud rain', 'snowflake', 'umbrella'],
  storm: ['lightning', 'cloud lightning'], hot: ['fire', 'thermometer hot', 'sun'], cold: ['snowflake', 'thermometer cold'],
  water: ['drop', 'waves'], night: ['moon', 'moon stars'], day: ['sun'], sky: ['cloud', 'sun', 'moon', 'star'], magic: ['magic wand', 'sparkle'],
  nature: ['leaf', 'tree', 'flower', 'plant', 'mountains'], garden: ['plant', 'flower', 'shovel', 'potted plant'],
  forest: ['tree', 'tree evergreen'], puppy: ['dog', 'paw print'], kitten: ['cat', 'paw print'], learn: ['graduation cap', 'book open', 'student'],
  work: ['briefcase', 'building office', 'desktop'], job: ['briefcase'], office: ['building office', 'briefcase'],
  business: ['briefcase', 'chart line up', 'handshake'], growth: ['chart line up', 'plant'], computer: ['desktop', 'laptop', 'monitor'],
  programming: ['code', 'terminal', 'brackets curly'], web: ['globe', 'browser', 'link'], website: ['browser', 'globe'],
  talk: ['chat circle', 'chats', 'microphone'], speech: ['chat circle', 'quotes'],
  game: ['game controller', 'dice five', 'puzzle piece', 'joystick'], soccer: ['soccer ball', 'football'], award: ['trophy', 'medal', 'seal check'],
  prize: ['trophy', 'medal'], health: ['heartbeat', 'first aid', 'pill', 'stethoscope'], fitness: ['barbell', 'heartbeat', 'person simple run'],
  running: ['person simple run', 'sneaker'], sleep: ['bed', 'moon'], happy: ['smiley', 'smiley wink'], energy: ['lightning', 'battery full', 'plug'],
  view: ['eye'], next: ['arrow right', 'caret right'], menu: ['list', 'dots three'], more: ['dots three', 'plus'],
  help: ['question', 'lifebuoy', 'info'], support: ['lifebuoy', 'hand heart', 'question'], charity: ['hand heart', 'heart'],
  donate: ['hand heart', 'hand coins'], tool: ['wrench', 'hammer', 'toolbox', 'screwdriver'], fix: ['wrench', 'hammer'],
  repair: ['wrench', 'toolbox'], space: ['rocket', 'planet', 'moon stars', 'shooting star'], fast: ['lightning', 'gauge', 'rocket'],
  earth: ['globe', 'globe hemisphere east'], eco: ['leaf', 'recycle', 'plant'], camping: ['tent', 'campfire', 'compass'],
  hiking: ['mountains', 'boot', 'person simple hike'], fashion: ['dress', 'handbag', 'sunglasses', 't shirt'],
  bathroom: ['toilet', 'shower', 'bathtub'], road: ['road horizon', 'path', 'signpost'], direction: ['signpost', 'compass', 'navigation arrow'],
  goal: ['target', 'flag checkered', 'trophy'], pointer: ['cursor', 'cursor click', 'hand pointing'], gem: ['diamond'], luxury: ['diamond', 'crown'],
  family: ['users three', 'house', 'baby'], child: ['baby', 'student'], clean: ['broom', 'sparkle'],
};

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const wordsOf = (s: string) => fold(s).split(' ').filter(Boolean);
const squash = (s: string) => fold(s).replace(/ /g, '');
const stem = (w: string) => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const memo = <K extends object, V>(f: (k: K) => V) => { const m = new WeakMap<K, V>(); return (k: K): V => { if (!m.has(k)) m.set(k, f(k)); return m.get(k)!; }; };
type Entry = { name: string; cat: number; flat: string; words: string[]; tags: string[]; stems: Set<string> };
const entriesOf = memo((index: IconIndex): Entry[] => index.icons.map(([name, cat, tagText]) => {
  const flat = squash(name), words = wordsOf(name), tags = wordsOf(tagText);
  return { name, cat, flat, words, tags, stems: new Set([flat, ...words, ...tags].map(stem)) };
}));
const groupsOf = memo((synonyms: Record<string, string[]>) => Object.entries(synonyms).map(([k, v]) => [stem(squash(k)), v.map(t => stem(squash(t)))] as const));
const grams = (w: string) => new Set(Array.from({ length: w.length }, (_, i) => ` ${w} `.slice(i, i + 3)));
/** Per category: the trigram sets of its name words and of its icons' name and tag words. */
const categoryGrams = memo((index: IconIndex) => {
  const entries = entriesOf(index);
  return index.categories.map((c, i) => [...new Set([...wordsOf(c), ...entries.filter(e => e.cat === i).flatMap(e => [...e.words, ...e.tags])])].map(grams));
});
const MISS = 9;
/**
 * 1.5 the query word is a synonym key and the icon is one of its listed answers (curated, D-074), 2 a name word starts
 * with the query word, 3 a tag does, 4 a synonym names or tags the icon, 5 the word sits inside a name word ("love" in clover).
 */
function level(e: Entry, w: string, terms: string[], answers: string[] = []): number {
  const s = stem(w);
  if (answers.some(t => e.stems.has(t))) return 1.5;
  if (e.words.some(x => x.startsWith(s))) return 2;
  if (e.tags.some(x => x.startsWith(s))) return 3;
  if (terms.some(t => e.stems.has(t))) return 4;
  return e.words.some(x => x.includes(w)) ? 5 : MISS;
}
/** The category nearest the query: best character-trigram Dice similarity of a query word to its words, then most picks, then earliest. */
function nearest(index: IconIndex, entries: Entry[], words: string[]): number {
  const queries = words.map(grams), picks = new Set(index.picks), dice = (a: Set<string>, b: Set<string>) => 2 * [...a].filter(g => b.has(g)).length / (a.size + b.size);
  const score = categoryGrams(index).map((terms, i) => [queries.reduce((m, q) => terms.reduce((n, t) => Math.max(n, dice(q, t)), m), 0), entries.filter(e => e.cat === i && picks.has(e.name)).length]);
  return score.reduce((best, s, i) => s[0] > score[best][0] || s[0] === score[best][0] && s[1] > score[best][1] ? i : best, 0);
}
/**
 * 5s: matches query words against names, tags and synonyms (accent- and case-insensitive, prefix matching, plural- and
 * hyphen/space-agnostic), ranked exact name, name prefix, a curated synonym answer, a name word, a tag, a synonym, inside a name word. Icons matching
 * every word come before icons matching some. Empty query → picks. No match → the nearest category's icons (its picks
 * first) with `category` set.
 */
export function searchIcons(index: IconIndex, q: string, synonyms: Record<string, string[]> = SYNONYMS, limit = 64): IconResult {
  const words = wordsOf(q), flat = words.join('');
  if (!words.length) return { names: index.picks.slice(0, limit) };
  const entries = entriesOf(index), groups = groupsOf(synonyms);
  const terms = words.map(w => groups.flatMap(([k, v]) => k === stem(w) ? [k, ...v] : v.includes(stem(w)) ? [k] : []));
  const answers = words.map(w => groups.flatMap(([k, v]) => k === stem(w) ? v : []));
  const scored = entries.map(e => {
    const hit = words.map((w, i) => level(e, w, terms[i], answers[i])).filter(l => l < MISS), sum = hit.reduce((a, b) => a + b, 0);
    if (e.flat.startsWith(flat)) return { e, miss: 0, rank: e.flat === flat ? 0 : 1, sum };
    return { e, miss: words.length - hit.length, rank: Math.max(...hit), sum };
  }).filter(s => s.miss < words.length);
  if (scored.length) {
    scored.sort((a, b) => a.miss - b.miss || a.rank - b.rank || a.sum - b.sum || a.e.name.length - b.e.name.length || (a.e.name < b.e.name ? -1 : 1));
    return { names: scored.slice(0, limit).map(s => s.e.name) };
  }
  const cat = nearest(index, entries, words), members = entries.filter(e => e.cat === cat).map(e => e.name);
  return { names: [...index.picks.filter(p => members.includes(p)), ...members.filter(n => !index.picks.includes(n))].slice(0, limit), category: index.categories[cat] };
}
