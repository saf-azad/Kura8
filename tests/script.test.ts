import { it, expect } from 'vitest';
import { direction, scriptOf, physicalAlign, fontStack, FONT_STACKS } from '../src/core/script';
it('takes direction from the first strong character (5r)', () => {
  expect(direction('Hello')).toBe('ltr'); expect(direction('مساحة بين')).toBe('rtl'); expect(direction('123 שלום')).toBe('rtl');
  expect(direction('2026 Event مساحة')).toBe('ltr'); expect(direction('')).toBe('ltr'); expect(direction('42!')).toBe('ltr');
});
it('detects the script and picks a fallback stack behind Space Grotesk', () => {
  expect(['Hello', 'مساحة', 'שלום', '空間', 'スペース', '空間とスペース', '공간', 'Привет', 'Γειά', 'नमस्ते', 'สวัสดี', '', '12'].map(scriptOf))
    .toEqual(['latin', 'arabic', 'hebrew', 'chinese', 'japanese', 'japanese', 'korean', 'cyrillic', 'greek', 'devanagari', 'thai', 'latin', 'latin']);
  expect(fontStack('مساحة')).toBe(FONT_STACKS.arabic); expect(Object.values(FONT_STACKS).every(s => s.startsWith('"Space Grotesk"'))).toBe(true);
});
it('turns start/end into physical alignment', () => {
  expect([physicalAlign('start', 'ltr'), physicalAlign('end', 'ltr'), physicalAlign('start', 'rtl'), physicalAlign('end', 'rtl'), physicalAlign('center', 'rtl')]).toEqual(['left', 'right', 'right', 'left', 'center']);
});
