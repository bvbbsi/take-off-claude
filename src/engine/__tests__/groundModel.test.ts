import { describe, expect, it } from 'vitest';
import { idw, weakest } from '../groundModel';

describe('markmodell (§10.1)', () => {
  it('IDW viktar närmare brunnar tyngre', () => {
    const r = idw([{ value: 2, distanceKm: 0.5 }, { value: 10, distanceKm: 1.5 }]);
    // vikter 4 och 0,444 → (8 + 4,44) / 4,444 = 2,8
    expect(r.value).toBeCloseTo(2.8, 1);
    expect(r.meanDistanceKm).toBeCloseTo(1);
    expect(r.std).toBeCloseTo(4);
  });
  it('svagaste confidence vinner', () => {
    expect(weakest('high', 'medium')).toBe('medium');
    expect(weakest('high', 'low', 'medium')).toBe('low');
    expect(weakest('high')).toBe('high');
  });
});
