// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

// Don't actually try to import the DB — we only test the pure helpers below.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/drizzle', () => ({ db: {} }));
vi.mock('@/lib/db/schema', () => ({ aiUsageLogs: {} }));

import { computeCostMicros } from './usage';

describe('computeCostMicros', () => {
  it('returns 0 for an unknown model', () => {
    expect(computeCostMicros('totally-unknown-model', 1000, 1000)).toBe(0);
  });

  it('returns 0 when both token counts are 0 even for a known model', () => {
    expect(computeCostMicros('gpt-4o-mini', 0, 0)).toBe(0);
  });

  it('uses the right rates for gpt-4o-mini ($0.15 / $0.60 per 1M)', () => {
    // 1000 input * 0.15 + 1000 output * 0.60 = 150 + 600 = 750 micros
    expect(computeCostMicros('gpt-4o-mini', 1000, 1000)).toBe(750);
  });

  it('uses the right rates for gpt-4o ($2.50 / $10.00 per 1M)', () => {
    expect(computeCostMicros('gpt-4o', 1000, 1000)).toBe(2500 + 10000);
  });

  it('uses the right rates for claude-haiku-4-5 ($1 / $5 per 1M)', () => {
    expect(computeCostMicros('claude-haiku-4-5', 1000, 1000)).toBe(1000 + 5000);
  });

  it('uses the right rates for gemini-2.0-flash ($0.10 / $0.40 per 1M)', () => {
    // 1000 input * 0.10 + 1000 output * 0.40 = 100 + 400 = 500 micros
    expect(computeCostMicros('gemini-2.0-flash', 1000, 1000)).toBe(500);
  });

  it('rounds to nearest integer when fractional', () => {
    // 333 input on gpt-4o-mini: 333 * 0.15 = 49.95 → 50
    expect(computeCostMicros('gpt-4o-mini', 333, 0)).toBe(50);
  });

  it('scales linearly with token count', () => {
    const single = computeCostMicros('gpt-4o-mini', 1000, 0);
    const tenfold = computeCostMicros('gpt-4o-mini', 10000, 0);
    expect(tenfold).toBe(single * 10);
  });
});
