import type { Align, FontId } from './document';
import { fontById } from './fonts';
// Scripts and direction (5r): the first strong character decides direction, align start/end follows it, and each
// script gets a fallback font stack behind Space Grotesk (which covers Latin and Vietnamese only). Stacks name
// system fonts; nothing is fetched.
export type Script = 'latin' | 'arabic' | 'hebrew' | 'japanese' | 'chinese' | 'korean' | 'cyrillic' | 'greek' | 'devanagari' | 'thai';
const RTL = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const TESTS: [Script, RegExp][] = [
  ['arabic', /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u], ['hebrew', /\p{Script=Hebrew}/u], ['korean', /\p{Script=Hangul}/u],
  ['japanese', /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ['chinese', /\p{Script=Han}/u], ['cyrillic', /\p{Script=Cyrillic}/u],
  ['greek', /\p{Script=Greek}/u], ['devanagari', /\p{Script=Devanagari}/u], ['thai', /\p{Script=Thai}/u],
];
const firstStrong = (text: string): string | undefined => text.match(/\p{L}/u)?.[0];
export const direction = (text: string): 'ltr' | 'rtl' => { const c = firstStrong(text); return c && RTL.test(c) ? 'rtl' : 'ltr'; };
/** The script of the first strong character; kana anywhere makes Han text Japanese. */
export function scriptOf(text: string): Script {
  const c = firstStrong(text);
  if (!c) return 'latin';
  const found = TESTS.find(([, re]) => re.test(c))?.[0] ?? 'latin';
  return found === 'chinese' && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text) ? 'japanese' : found;
}
export const physicalAlign = (align: Align, dir: 'ltr' | 'rtl'): 'left' | 'center' | 'right' => align === 'center' ? 'center' : (align === 'start') === (dir === 'ltr') ? 'left' : 'right';
const GROTESK = '"Space Grotesk"';
export const FONT_STACKS: Record<Script, string> = {
  latin: `${GROTESK}, system-ui, sans-serif`,
  arabic: `${GROTESK}, "Noto Sans Arabic", "Geeza Pro", "Segoe UI", Tahoma, sans-serif`,
  hebrew: `${GROTESK}, "Noto Sans Hebrew", "Arial Hebrew", "Segoe UI", Arial, sans-serif`,
  japanese: `${GROTESK}, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", Meiryo, sans-serif`,
  chinese: `${GROTESK}, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
  korean: `${GROTESK}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`,
  cyrillic: `${GROTESK}, system-ui, "Segoe UI", Roboto, Arial, sans-serif`,
  greek: `${GROTESK}, system-ui, "Segoe UI", Roboto, Arial, sans-serif`,
  devanagari: `${GROTESK}, "Kohinoor Devanagari", "Nirmala UI", "Noto Sans Devanagari", sans-serif`,
  thai: `${GROTESK}, Thonburi, "Leelawadee UI", "Noto Sans Thai", sans-serif`,
};
/** The font stack for text in a typeface (D-049): the chosen face first, then the script's fallbacks. */
export function fontStack(text: string, font?: FontId): string {
  const script = scriptOf(text), def = fontById(font);
  if (def.id === 'grotesk') return FONT_STACKS[script];
  return `"${def.family}", ${script === 'latin' ? def.fallback : FONT_STACKS[script].slice(GROTESK.length + 2)}`;
}
