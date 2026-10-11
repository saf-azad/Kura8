import type { FontId } from '../../core/document';
// Latin and Latin Extended woff2 files of each document face (D-049), for embedding in SVG exports.
import poppins400latin from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import poppins400latinext from '@fontsource/poppins/files/poppins-latin-ext-400-normal.woff2?url';
import poppins700latin from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import poppins700latinext from '@fontsource/poppins/files/poppins-latin-ext-700-normal.woff2?url';
import playfair400latin from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfair400latinext from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-normal.woff2?url';
import playfair700latin from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfair700latinext from '@fontsource/playfair-display/files/playfair-display-latin-ext-700-normal.woff2?url';
import lora400latin from '@fontsource/lora/files/lora-latin-400-normal.woff2?url';
import lora400latinext from '@fontsource/lora/files/lora-latin-ext-400-normal.woff2?url';
import lora700latin from '@fontsource/lora/files/lora-latin-700-normal.woff2?url';
import lora700latinext from '@fontsource/lora/files/lora-latin-ext-700-normal.woff2?url';
import bebas400latin from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import bebas400latinext from '@fontsource/bebas-neue/files/bebas-neue-latin-ext-400-normal.woff2?url';
import caveat400latin from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import caveat400latinext from '@fontsource/caveat/files/caveat-latin-ext-400-normal.woff2?url';
import caveat700latin from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import caveat700latinext from '@fontsource/caveat/files/caveat-latin-ext-700-normal.woff2?url';
import mono400latin from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import mono400latinext from '@fontsource/space-mono/files/space-mono-latin-ext-400-normal.woff2?url';
import mono700latin from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import mono700latinext from '@fontsource/space-mono/files/space-mono-latin-ext-700-normal.woff2?url';
export const FONT_FILES: { font: FontId; weight: 400 | 700; subset: 'latin' | 'latin-ext'; url: string }[] = [
  { font: 'poppins', weight: 400, subset: 'latin', url: poppins400latin },
  { font: 'poppins', weight: 400, subset: 'latin-ext', url: poppins400latinext },
  { font: 'poppins', weight: 700, subset: 'latin', url: poppins700latin },
  { font: 'poppins', weight: 700, subset: 'latin-ext', url: poppins700latinext },
  { font: 'playfair', weight: 400, subset: 'latin', url: playfair400latin },
  { font: 'playfair', weight: 400, subset: 'latin-ext', url: playfair400latinext },
  { font: 'playfair', weight: 700, subset: 'latin', url: playfair700latin },
  { font: 'playfair', weight: 700, subset: 'latin-ext', url: playfair700latinext },
  { font: 'lora', weight: 400, subset: 'latin', url: lora400latin },
  { font: 'lora', weight: 400, subset: 'latin-ext', url: lora400latinext },
  { font: 'lora', weight: 700, subset: 'latin', url: lora700latin },
  { font: 'lora', weight: 700, subset: 'latin-ext', url: lora700latinext },
  { font: 'bebas', weight: 400, subset: 'latin', url: bebas400latin },
  { font: 'bebas', weight: 400, subset: 'latin-ext', url: bebas400latinext },
  { font: 'caveat', weight: 400, subset: 'latin', url: caveat400latin },
  { font: 'caveat', weight: 400, subset: 'latin-ext', url: caveat400latinext },
  { font: 'caveat', weight: 700, subset: 'latin', url: caveat700latin },
  { font: 'caveat', weight: 700, subset: 'latin-ext', url: caveat700latinext },
  { font: 'mono', weight: 400, subset: 'latin', url: mono400latin },
  { font: 'mono', weight: 400, subset: 'latin-ext', url: mono400latinext },
  { font: 'mono', weight: 700, subset: 'latin', url: mono700latin },
  { font: 'mono', weight: 700, subset: 'latin-ext', url: mono700latinext },
];
