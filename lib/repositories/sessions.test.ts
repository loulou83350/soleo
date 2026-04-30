// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Minimal stubs for Drizzle chain ────────────────────────────────────────

const mockReturnFirst = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

// Each call to insert() returns a chain: .values() -> .returning()
// We need multiple independent chains, so we build them per-call
let insertCallCount = 0;
const insertReturns: Array<unknown> = [];

const mockDb = {
  insert: vi.fn(() => {
    const callIdx = insertCallCount++;
    return {
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(insertReturns[callIdx] ?? [])),
      })),
    };
  }),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: mockOrderBy,
        limit: mockLimit,
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
};

vi.mock('@/lib/db/drizzle', () => ({ db: mockDb }));

vi.mock('@/lib/db/schema', () => ({
  sessions: {},
  sessionBlocks: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  asc: vi.fn(() => 'asc'),
  desc: vi.fn(() => 'desc'),
  inArray: vi.fn(() => 'inArray'),
}));

vi.mock('@paralleldrive/cuid2', () => ({
  createId: vi.fn(() => 'test-cuid2-token'),
}));

vi.mock('@/lib/domain/blocks', () => ({
  ANCHOR_BLOCK_TYPES: ['welcome', 'thank_you'],
  BLOCK_DEFAULTS: {
    welcome:          { title: '', description: '', buttonText: 'Commencer' },
    thank_you:        { title: 'Merci !', description: '' },
    short_text:       { question: '', placeholder: '' },
  },
  BLOCK_LABELS: {
    welcome:          'Accueil',
    thank_you:        'Remerciement',
    content:          'Contenu',
    short_text:       'Question courte',
    long_text:        'Question longue',
    mcq:              'Choix multiple',
    likert:           'Échelle de Likert',
    rating:           'Note',
    nps:              'NPS',
    card_sort:        'Tri de carte',
    matrix:           'Matrice',
    first_impression: 'Premier regard',
    prototype_task:   'Tâche prototype',
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCallCount = 0;
    insertReturns.length = 0;
    vi.resetModules();
  });

  it('inserts a session record and returns it', async () => {
    const fakeSession = {
      id: 1, teamId: 10, projectId: 5,
      title: 'Nouvelle session', status: 'draft',
      createdAt: new Date(), updatedAt: new Date(),
    };
    // insert returns: [session], [] (session + single batch insert for 3 blocks = 2 inserts)
    insertReturns.push(
      [fakeSession], // session
      [],            // batch insert: welcome + short_text + thank_you blocks
    );

    const { createSession } = await import('./sessions');
    const result = await createSession(10, 5);

    expect(result).toEqual(fakeSession);
    // 1 session insert + 1 batch blocks insert = 2 inserts
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});

describe('updateSessionTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calls db.update once with the new title', async () => {
    const { updateSessionTitle } = await import('./sessions');
    await updateSessionTitle(42, 10, 'Mon nouveau titre');
    expect(mockDb.update).toHaveBeenCalledOnce();
  });
});

describe('getSessionsByProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns an empty array when no sessions exist', async () => {
    mockOrderBy.mockResolvedValueOnce([]);
    const { getSessionsByProject } = await import('./sessions');
    const result = await getSessionsByProject(5, 10);
    expect(result).toEqual([]);
  });

  it('returns all sessions for the project', async () => {
    const fakeSessions = [
      { id: 1, projectId: 5, teamId: 10, title: 'Session 1', status: 'draft' },
      { id: 2, projectId: 5, teamId: 10, title: 'Session 2', status: 'draft' },
    ];
    mockOrderBy.mockResolvedValueOnce(fakeSessions);
    const { getSessionsByProject } = await import('./sessions');
    const result = await getSessionsByProject(5, 10);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Session 1');
  });
});

describe('getSessionWithBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when session not found', async () => {
    mockLimit.mockResolvedValueOnce([]); // no session
    const { getSessionWithBlocks } = await import('./sessions');
    const result = await getSessionWithBlocks(99, 10);
    expect(result).toBeNull();
  });

  it('returns session with empty blocks when session exists but has no blocks', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft' };
    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { getSessionWithBlocks } = await import('./sessions');
    const result = await getSessionWithBlocks(1, 10);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.blocks).toEqual([]);
  });
});

// addPage and reorderPages removed — flat block model (no more pages)
// Block operations are tested in blocks.test.ts

// ─── publishSession ───────────────────────────────────────────────────────────

describe('publishSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCallCount = 0;
    insertReturns.length = 0;
    vi.resetModules();
  });

  it('throws when session not found', async () => {
    mockLimit.mockResolvedValueOnce([]); // getSessionWithPages → null
    const { publishSession } = await import('./sessions');
    await expect(publishSession(1, 10)).rejects.toThrow('Session introuvable');
  });

  it('throws with validationIssues when a block has an empty question', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft', sessionToken: null };
    // Flat model: welcome + emptyBlock + thank_you in a single blocks array
    const emptyBlock = { id: 2, sessionId: 1, blockType: 'short_text', config: { question: '' }, required: false, position: 2 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([emptyBlock]);

    const { publishSession } = await import('./sessions');
    const err = await publishSession(1, 10).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const typedErr = err as Error & { validationIssues: Array<{ issue: string }> };
    expect(typedErr.validationIssues).toHaveLength(1);
    expect(typedErr.validationIssues[0].issue).toBe('Question vide');
  });

  it('publishes and returns a token when all blocks are valid', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft', sessionToken: null };
    const validBlock = { id: 2, sessionId: 1, blockType: 'short_text', config: { question: 'Votre nom ?' }, required: false, position: 2 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([validBlock]);

    const { publishSession } = await import('./sessions');
    const token = await publishSession(1, 10);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('returns existing token without calling update when already published', async () => {
    const existingToken = 'already-published-token';
    const fakeSession = { id: 1, teamId: 10, status: 'published', sessionToken: existingToken };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([]); // blocks (empty is fine — early return via token check)

    const { publishSession } = await import('./sessions');
    const token = await publishSession(1, 10);

    expect(token).toBe(existingToken);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('throws validationIssues when first_impression block has no imageUrl', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft', sessionToken: null };
    const block = { id: 2, sessionId: 1, blockType: 'first_impression', config: { imageUrl: '', duration: 5, instructions: '' }, required: false, position: 2 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([block]);

    const { publishSession } = await import('./sessions');
    const err = await publishSession(1, 10).catch((e: unknown) => e);

    const typedErr = err as Error & { validationIssues: Array<{ issue: string }> };
    expect(typedErr.validationIssues[0].issue).toBe('Image requise');
  });
});

// ─── getSessionByToken ────────────────────────────────────────────────────────

describe('getSessionByToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when token not found', async () => {
    mockLimit.mockResolvedValueOnce([]);
    const { getSessionByToken } = await import('./sessions');
    const result = await getSessionByToken('invalid-token');
    expect(result).toBeNull();
  });

  it('returns session with blocks when token is valid', async () => {
    const fakeSession = { id: 1, teamId: 10, status: 'published', sessionToken: 'valid-token', title: 'Test' };
    const block = { id: 10, sessionId: 1, position: 1, blockType: 'welcome', config: {}, required: false };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([block]);

    const { getSessionByToken } = await import('./sessions');
    const result = await getSessionByToken('valid-token');

    expect(result).not.toBeNull();
    expect(result?.sessionToken).toBe('valid-token');
    expect(result?.blocks).toHaveLength(1);
  });

  it('returns session with empty blocks when no blocks exist', async () => {
    const fakeSession = { id: 2, status: 'published', sessionToken: 'tok', title: 'Empty' };
    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { getSessionByToken } = await import('./sessions');
    const result = await getSessionByToken('tok');

    expect(result?.blocks).toEqual([]);
  });
});
