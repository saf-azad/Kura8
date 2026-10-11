import type { ColourRef, Palette, Role, RowId, Step } from './document';
// Colour comes from one hue. Every row is seven lightness steps; roles are positions on rows (ground and ink on the
// base row, accent on the complementary row) and dark mode mirrors every row reference from step s to 6 − s (5i).
// Literal hex colours never mirror. A pasted hex becomes a custom row c{n} with the nearest step replaced by it (5g).
export const LIGHTNESS = [92, 78, 64, 50, 36, 22, 10] as const;
/** The 12 dial hues; the 13th dial position is neutral (no hue). */
export const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SAT = { base: 40, accent: 55 };
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
export function hsl(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + h / 30) % 12; return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255; };
  return `#${hex2(f(0))}${hex2(f(8))}${hex2(f(4))}`;
}
export function rgbOf(hex: string): [number, number, number] { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function hslOf(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgbOf(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0, l: l * 100 };
}
export function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100;
  const f = (n: number) => { const k = (n + h / 60) % 6; return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255; };
  return `#${hex2(f(5))}${hex2(f(3))}${hex2(f(1))}`;
}
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = rgbOf(hex).map(v => v / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60) % 360, s: max ? Math.round(d / max * 100) : 0, v: Math.round(max * 100) };
}
/** The dial swatch for a hue, or the paper grey for neutral. */
export const hueSwatch = (hue: number | null): string => hue === null ? '#ecf0f3' : hsl(hue, 55, 50);
export const paletteFor = (hue: number | null, dark: boolean): Palette => ({ hue, dark, custom: [] });
const nearestStep = (l: number): Step => LIGHTNESS.reduce<number>((best, v, i) => Math.abs(v - l) < Math.abs(LIGHTNESS[best] - l) ? i : best, 0) as Step;
/** A row built from a hex: its hue and saturation at the seven lightness steps, with the nearest step replaced by the hex itself. */
export function rowFromHex(hex: string): string[] {
  const { h, s, l } = hslOf(hex), step = nearestStep(l);
  return LIGHTNESS.map((v, i) => i === step ? hex.toLowerCase() : hsl(h, s, v));
}
export function rows(p: Palette): Record<RowId, string[]> {
  const hue = p.hue ?? 0, sat = (s: number) => p.hue === null ? 0 : s;
  const out: Record<string, string[]> = {
    base: LIGHTNESS.map(l => hsl(hue, sat(SAT.base), l)),
    accent: p.accent ? rowFromHex(p.accent) : LIGHTNESS.map(l => hsl((hue + 180) % 360, sat(SAT.accent), l)),
  };
  p.custom.forEach((hex, i) => { out[`c${i}`] = rowFromHex(hex); });
  return out as Record<RowId, string[]>;
}
/** Where a role sits in light mode. Accent is mid-scale on the accent row (or wherever a custom accent falls); neutral accent is ink. */
export function roleRef(role: Role, p: Palette): { row: RowId; step: Step } {
  if (role === 'ground') return { row: 'base', step: 0 };
  if (role === 'ink') return { row: 'base', step: 6 };
  if (p.accent) return { row: 'accent', step: nearestStep(hslOf(p.accent).l) };
  return { row: 'accent', step: p.hue === null ? 6 : 3 };
}
/** The row and step a reference resolves to after the dark mirror, or null for literal hex. */
export function placeOf(ref: ColourRef, p: Palette): { row: RowId; step: Step } | null {
  if ('hex' in ref) return null;
  const at = 'role' in ref ? roleRef(ref.role, p) : ref;
  return { row: at.row, step: (p.dark ? 6 - at.step : at.step) as Step };
}
export function resolve(ref: ColourRef, p: Palette): string {
  const at = placeOf(ref, p);
  if (!at) return (ref as { hex: string }).hex.toLowerCase();
  return (rows(p)[at.row] ?? rows(p).base)[at.step];
}
/** Adds a pasted hex as a custom row (5g), reusing an existing one with the same hex. */
export function addCustom(p: Palette, hex: string): { palette: Palette; ref: { row: RowId; step: Step } } {
  const lower = hex.toLowerCase(), found = p.custom.indexOf(lower), index = found >= 0 ? found : p.custom.length;
  const palette = found >= 0 ? p : { ...p, custom: [...p.custom, lower] };
  return { palette, ref: { row: `c${index}`, step: nearestStep(hslOf(lower).l) } };
}
const channel = (v: number) => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
export const luminance = (hex: string): number => { const [r, g, b] = rgbOf(hex).map(channel); return .2126 * r + .7152 * g + .0722 * b; };
/** WCAG contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + .05) / (y + .05);
}
/**
 * The step on the same row nearest to `ref` that reaches `min` contrast against `bg` (5h), or null when it already passes
 * or none does. Literal hex uses the row built from it. Given several backdrops (text across a band and the ground), the
 * step must pass on all of them, and the ratio is the lowest (D-090).
 */
export function passingShade(ref: ColourRef, bg: string | string[], p: Palette, min = 4.5): { ref: ColourRef; hex: string; ratio: number } | null {
  const hex = resolve(ref, p), bgs = Array.isArray(bg) ? bg : [bg], worst = (c: string) => Math.min(...bgs.map(b => contrast(c, b)));
  if (worst(hex) >= min) return null;
  const at = placeOf(ref, p), row = at ? rows(p)[at.row] ?? rows(p).base : rowFromHex(hex), from = at ? at.step : nearestStep(hslOf(hex).l);
  const order = LIGHTNESS.map((_, i) => i).filter(i => i !== from).sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);
  for (const i of order) {
    const ratio = worst(row[i]);
    if (ratio < min) continue;
    const step = (p.dark && at ? 6 - i : i) as Step;
    return { ref: at ? { row: at.row, step } : { hex: row[i] }, hex: row[i], ratio };
  }
  return null;
}
