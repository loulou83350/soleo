// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '@/lib/db/drizzle';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTurn(overrides = {}) {
  return {
    id: 1,
    blockId: 10,
    parentResponseId: 100,
    participantSessionId: 1000,
    turnNumber: 1,
    aiQuestion: 'Pouvez-vous donner un exemple ?',
    participantAnswer: null,
    status: 'answered' as const,
    provider: 'openai',
    model: 'gpt-4o-mini',
    createdAt: new Date('2026-04-30'),
    ...overrides,
  };
}

function makeSelectChain(returnValue: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(returnValue);
  return chain;
}

function makeInsertChain(returnValue: unknown[]) {
  const chain = {
    values: vi.fn(),
    returning: vi.fn(),
  };
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returnValue);
  return chain;
}

function makeUpdateChain(returnValue: unknown[]) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returnValue);
  return chain;
}

// ─── insertTurn ─────────────────────────────────────────────────────────────

describe('insertTurn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insère un turn et retourne la ligne', async () => {
    const turn = makeTurn();
    const chain = makeInsertChain([turn]);
    vi.mocked(db.insert).mockReturnValue(chain as unknown as ReturnType<typeof db.insert>);

    const { insertTurn } = await import('./ai-followup');
    const out = await insertTurn({
      blockId: 10,
      parentResponseId: 100,
      participantSessionId: 1000,
      turnNumber: 1,
      aiQuestion: 'Pouvez-vous donner un exemple ?',
      participantAnswer: null,
      status: 'answered',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });

    expect(db.insert).toHaveBeenCalled();
    expect(out.id).toBe(1);
    expect(out.aiQuestion).toContain('exemple');
  });
});

// ─── updateTurnAnswer ──────────────────────────────────────────────────────

describe('updateTurnAnswer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('met à jour la réponse + status answered', async () => {
    const updated = makeTurn({ participantAnswer: 'Voici un exemple…', status: 'answered' });
    const chain = makeUpdateChain([updated]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const { updateTurnAnswer } = await import('./ai-followup');
    const out = await updateTurnAnswer(1, 1000, 'Voici un exemple…', 'answered');

    expect(db.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith({
      participantAnswer: 'Voici un exemple…',
      status: 'answered',
    });
    expect(out?.participantAnswer).toBe('Voici un exemple…');
    expect(out?.status).toBe('answered');
  });

  it('marque skipped quand action skip', async () => {
    const updated = makeTurn({ participantAnswer: null, status: 'skipped' });
    const chain = makeUpdateChain([updated]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const { updateTurnAnswer } = await import('./ai-followup');
    const out = await updateTurnAnswer(1, 1000, null, 'skipped');

    expect(out?.status).toBe('skipped');
    expect(out?.participantAnswer).toBeNull();
  });

  it('retourne null si la ligne est introuvable (ex: mauvais participantSessionId)', async () => {
    const chain = makeUpdateChain([]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const { updateTurnAnswer } = await import('./ai-followup');
    const out = await updateTurnAnswer(99, 9999, 'x', 'answered');

    expect(out).toBeNull();
  });
});

// ─── getTurnsForResponse(s) ────────────────────────────────────────────────

describe('getTurnsForResponse', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne les turns triés par turnNumber asc', async () => {
    const turns = [
      makeTurn({ id: 1, turnNumber: 1 }),
      makeTurn({ id: 2, turnNumber: 2 }),
    ];
    const chain = makeSelectChain(turns);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getTurnsForResponse } = await import('./ai-followup');
    const out = await getTurnsForResponse(100);

    expect(db.select).toHaveBeenCalled();
    expect(out).toHaveLength(2);
    expect(out[0].turnNumber).toBe(1);
    expect(out[1].turnNumber).toBe(2);
  });

  it('retourne un tableau vide quand pas de turns', async () => {
    const chain = makeSelectChain([]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getTurnsForResponse } = await import('./ai-followup');
    const out = await getTurnsForResponse(100);
    expect(out).toEqual([]);
  });
});

describe('getTurnsForResponses (batch)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne une Map vide quand aucun id', async () => {
    const { getTurnsForResponses } = await import('./ai-followup');
    const out = await getTurnsForResponses([]);
    expect(out.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('groupe les turns par parentResponseId', async () => {
    const turns = [
      makeTurn({ id: 1, parentResponseId: 100, turnNumber: 1 }),
      makeTurn({ id: 2, parentResponseId: 100, turnNumber: 2 }),
      makeTurn({ id: 3, parentResponseId: 200, turnNumber: 1 }),
    ];
    const chain = makeSelectChain(turns);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getTurnsForResponses } = await import('./ai-followup');
    const out = await getTurnsForResponses([100, 200, 300]);

    expect(out.get(100)).toHaveLength(2);
    expect(out.get(200)).toHaveLength(1);
    expect(out.get(300)).toBeUndefined();
  });
});
