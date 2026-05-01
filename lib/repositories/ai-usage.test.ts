// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@/lib/db/drizzle';

function makeAggRow(overrides = {}) {
  return {
    feature: 'tag_suggest',
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsdMicros: 0,
    ...overrides,
  };
}

function makeChain(returnValue: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.groupBy.mockResolvedValue(returnValue);
  return chain;
}

describe('getUsageSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne un summary vide quand aucun usage', async () => {
    const chain = makeChain([]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getUsageSummary } = await import('./ai-usage');
    const out = await getUsageSummary(10, new Date('2026-04-01'));

    expect(out.totalCalls).toBe(0);
    expect(out.totalInputTokens).toBe(0);
    expect(out.totalOutputTokens).toBe(0);
    expect(out.totalCostUsdMicros).toBe(0);
    expect(out.byFeature).toEqual([]);
  });

  it('aggrège les totaux à travers les features', async () => {
    const rows = [
      makeAggRow({ feature: 'tag_suggest', calls: 5, inputTokens: 500, outputTokens: 100, costUsdMicros: 135 }),
      makeAggRow({ feature: 'findings_generate', calls: 2, inputTokens: 3000, outputTokens: 500, costUsdMicros: 5500 }),
      makeAggRow({ feature: 'ai_followup', calls: 12, inputTokens: 1800, outputTokens: 400, costUsdMicros: 510 }),
    ];
    const chain = makeChain(rows);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getUsageSummary } = await import('./ai-usage');
    const out = await getUsageSummary(10, new Date('2026-04-01'));

    expect(out.totalCalls).toBe(5 + 2 + 12);
    expect(out.totalInputTokens).toBe(500 + 3000 + 1800);
    expect(out.totalOutputTokens).toBe(100 + 500 + 400);
    expect(out.totalCostUsdMicros).toBe(135 + 5500 + 510);
    expect(out.byFeature).toHaveLength(3);
  });

  it('trie byFeature par coût décroissant', async () => {
    const rows = [
      makeAggRow({ feature: 'tag_suggest', costUsdMicros: 100 }),
      makeAggRow({ feature: 'findings_generate', costUsdMicros: 9999 }),
      makeAggRow({ feature: 'ai_followup', costUsdMicros: 500 }),
    ];
    const chain = makeChain(rows);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getUsageSummary } = await import('./ai-usage');
    const out = await getUsageSummary(10, new Date('2026-04-01'));

    expect(out.byFeature.map((r) => r.feature)).toEqual([
      'findings_generate',
      'ai_followup',
      'tag_suggest',
    ]);
  });
});

describe('startOfCurrentMonth', () => {
  it('retourne le 1er du mois UTC à minuit', async () => {
    const { startOfCurrentMonth } = await import('./ai-usage');
    const d = startOfCurrentMonth();
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});
