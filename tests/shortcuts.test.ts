import { expect, it } from 'vitest';
import { isMac, primaryModifier, shortcutLabel } from '../src/app/tools/shortcuts';
it('uses Command only on Apple platforms and Control only on PCs', () => {
  for (const platform of ['MacIntel', 'iPad', 'iPhone']) expect(isMac(platform)).toBe(true);
  for (const platform of ['Win32', 'Linux x86_64']) expect(isMac(platform)).toBe(false);
  expect(primaryModifier({ metaKey: true, ctrlKey: false }, true)).toBe(true);
  expect(primaryModifier({ metaKey: false, ctrlKey: true }, false)).toBe(true);
  expect(primaryModifier({ metaKey: false, ctrlKey: true }, true)).toBe(false);
  expect(primaryModifier({ metaKey: true, ctrlKey: false }, false)).toBe(false);
  expect(primaryModifier({ metaKey: true, ctrlKey: true }, true)).toBe(false);
  expect(shortcutLabel('Mod+Shift+L', true)).toBe('⌘+⇧+L');
  expect(shortcutLabel('Mod+Shift+L', false)).toBe('Ctrl+Shift+L');
});
