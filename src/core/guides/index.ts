import { thirds } from './thirds';
import { golden } from './golden';
import { divisions } from './divisions';
import type { GuideId } from './types';
export const guides = [thirds, golden, divisions];
export const guideById = (id: GuideId) => guides.find(g => g.id === id)!;
