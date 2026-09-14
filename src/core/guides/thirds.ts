import type { Guide } from './types';
import { grid } from './grid';
export const thirds: Guide = { id: 'thirds', name: 'Rule of thirds', generate: canvas => grid(canvas, [1 / 3, 2 / 3], true) };
