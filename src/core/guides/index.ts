import { thirds } from './thirds';
import { golden, PHI } from './golden';
import { divisions } from './divisions';
import type { GuideId } from './types';
export const guides = [thirds, golden, divisions];
export const guideById = (id: GuideId) => guides.find(g => g.id === id)!;
/** The guide's line positions as fractions of the canvas, the same on both axes. */
export const fractionsOf = (id: GuideId): number[] => id === 'thirds' ? [1 / 3, 2 / 3] : id === 'golden' ? [1 - 1 / PHI, 1 / PHI] : [1 / 4, 1 / 2, 3 / 4];
/** Type-scale factor per guide: 1.5, φ, √2. */
export const scaleFactorOf = (id: GuideId): number => id === 'thirds' ? 1.5 : id === 'golden' ? PHI : Math.SQRT2;
