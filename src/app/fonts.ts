// Text faces (D-045): OFL-1.1 families bundled by Vite and served from the app's own origin. The browser fetches a
// face only when text uses it; `fontReady` reports when one arrives so measurements and drawings can be redone.
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/400-italic.css';
import '@fontsource/montserrat/700-italic.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/700-italic.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/space-mono/400-italic.css';
import '@fontsource/space-mono/700-italic.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
const pending = new Set<string>(), listeners = new Set<() => void>();
/** Calls `fn` whenever a face finishes loading. */
export function onFontReady(fn: () => void): void { listeners.add(fn); }
/** Starts loading the face a CSS font shorthand names, once; listeners run when it lands. */
export function ensureFont(font: string, sample = 'Aa'): void {
  if (pending.has(font) || !document.fonts || document.fonts.check(font, sample)) return;
  pending.add(font);
  void document.fonts.load(font, sample).then(() => { for (const fn of listeners) fn(); }).catch(() => {});
}
