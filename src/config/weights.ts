import type { FacilityType, ScoreKey, Weights } from '../types';

// Viktning per anläggningstyp (SPEC §9.3)
export const WEIGHTS: Record<FacilityType, Weights> = {
  datacenter: { power: 0.3, timeToPower: 0.2, ground: 0.2, planning: 0.15, logistics: 0.15 },
  bess: { power: 0.35, timeToPower: 0.25, ground: 0.1, planning: 0.2, logistics: 0.1 },
  industri: { power: 0.25, timeToPower: 0.15, ground: 0.2, planning: 0.15, logistics: 0.25 },
  logistik: { power: 0.1, timeToPower: 0.05, ground: 0.3, planning: 0.2, logistics: 0.35 },
  vatgas: { power: 0.35, timeToPower: 0.2, ground: 0.15, planning: 0.15, logistics: 0.15 },
  ovrigt: { power: 0.2, timeToPower: 0.2, ground: 0.2, planning: 0.2, logistics: 0.2 },
};

export const SCORE_LABELS: Record<ScoreKey, string> = {
  power: 'Effekt',
  timeToPower: 'Tid till effekt',
  ground: 'Mark',
  planning: 'Plan',
  logistics: 'Logistik',
};

export const SCORE_KEYS: ScoreKey[] = ['power', 'timeToPower', 'ground', 'planning', 'logistics'];
