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
  sessionPages: {},
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
  BLOCK_LABELS: {
    short_text: 'Question courte',
    long_text: 'Question longue',
    mcq: 'Choix multiple',
    likert: 'Échelle de Likert',
    rating: 'Note',
    nps: 'NPS',
    card_sort: 'Tri de carte',
    matrix: 'Matrice',
    first_impression: 'Premier regard',
    prototype_task: 'Tâche prototype',
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
    const fakePage = {
      id: 100, sessionId: 1, position: 2,
      title: 'Page 1', pageType: 'question',
    };
    // insert returns: [session], [], [questionPage], [], []
    insertReturns.push(
      [fakeSession], // session
      [],            // intro page (no .returning used, but mock chain needs something)
      [fakePage],    // question page
      [],            // block
      [],            // end page
    );

    const { createSession } = await import('./sessions');
    const result = await createSession(10, 5);

    expect(result).toEqual(fakeSession);
    // session + 3 pages + 1 block = 5 inserts
    expect(mockDb.insert).toHaveBeenCalledTimes(5);
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

describe('getSessionWithPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when session not found', async () => {
    mockLimit.mockResolvedValueOnce([]); // no session
    const { getSessionWithPages } = await import('./sessions');
    const result = await getSessionWithPages(99, 10);
    expect(result).toBeNull();
  });

  it('returns session with empty pages when session exists but has no pages', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft' };
    mockLimit.mockResolvedValueOnce([fakeSession]);
    // Only one mockOrderBy call: pages → [] (blocks query is skipped when pages is empty)
    mockOrderBy.mockResolvedValueOnce([]);

    const { getSessionWithPages } = await import('./sessions');
    const result = await getSessionWithPages(1, 10);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.pages).toEqual([]);
  });
});

describe('addPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCallCount = 0;
    insertReturns.length = 0;
    vi.resetModules();
  });

  it('throws when session not found', async () => {
    mockLimit.mockResolvedValueOnce([]); // session not found
    const { addPage } = await import('./sessions');
    await expect(addPage(1, 10, 100)).rejects.toThrow('Session not found');
  });

  it('inserts one new page record when adding a page', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft' };
    const introPage = { id: 10, sessionId: 1, position: 1, title: 'Introduction', pageType: 'intro' };
    const questionPage = { id: 20, sessionId: 1, position: 2, title: 'Page 1', pageType: 'question' };
    const endPage = { id: 30, sessionId: 1, position: 3, title: 'Fin', pageType: 'end' };
    const newPage = { id: 40, sessionId: 1, position: 9999, title: 'Page 2', pageType: 'question' };
    const currentPages = [introPage, questionPage, endPage];
    const finalPages = [introPage, questionPage, newPage, endPage];

    mockLimit.mockResolvedValue([fakeSession]);
    mockOrderBy.mockResolvedValue(currentPages).mockResolvedValueOnce(currentPages).mockResolvedValueOnce(finalPages);

    insertReturns.push([newPage]);
    insertCallCount = 0;

    const { addPage } = await import('./sessions');
    await addPage(1, 10, 20);

    // Exactly one insert: the new page
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    // At least one update (renumber): verifies the renumbering path was reached
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe('reorderPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when session not found', async () => {
    mockLimit.mockResolvedValueOnce([]);
    const { reorderPages } = await import('./sessions');
    await expect(reorderPages(1, 10, [10, 20, 30])).rejects.toThrow('Session not found');
  });

  it('updates each page position according to orderedPageIds order', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5 };
    mockLimit.mockResolvedValueOnce([fakeSession]);

    const { reorderPages } = await import('./sessions');
    await reorderPages(1, 10, [10, 20, 30]);

    // Three pages → three update calls
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });
});

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
    const questionPage = { id: 20, sessionId: 1, position: 2, title: 'Page 1', pageType: 'question' };
    const emptyBlock = { id: 1, sessionPageId: 20, blockType: 'short_text', config: { question: '' }, required: false, position: 1 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy
      .mockResolvedValueOnce([questionPage])
      .mockResolvedValueOnce([emptyBlock]);

    const { publishSession } = await import('./sessions');
    const err = await publishSession(1, 10).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    const typedErr = err as Error & { validationIssues: Array<{ issue: string }> };
    expect(typedErr.validationIssues).toHaveLength(1);
    expect(typedErr.validationIssues[0].issue).toBe('Question vide');
  });

  it('publishes and returns a token when all blocks are valid', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft', sessionToken: null };
    const questionPage = { id: 20, sessionId: 1, position: 2, title: 'Page 1', pageType: 'question' };
    const validBlock = { id: 1, sessionPageId: 20, blockType: 'short_text', config: { question: 'Votre nom ?' }, required: false, position: 1 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy
      .mockResolvedValueOnce([questionPage])
      .mockResolvedValueOnce([validBlock]);

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
    // Only one mockOrderBy call: pages → [] (early return before blocks query)
    mockOrderBy.mockResolvedValueOnce([]);

    const { publishSession } = await import('./sessions');
    const token = await publishSession(1, 10);

    expect(token).toBe(existingToken);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('throws validationIssues when first_impression block has no imageUrl', async () => {
    const fakeSession = { id: 1, teamId: 10, projectId: 5, title: 'S1', status: 'draft', sessionToken: null };
    const questionPage = { id: 20, sessionId: 1, position: 2, title: 'Page 1', pageType: 'question' };
    const block = { id: 1, sessionPageId: 20, blockType: 'first_impression', config: { imageUrl: '', duration: 5, instructions: '' }, required: false, position: 1 };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy
      .mockResolvedValueOnce([questionPage])
      .mockResolvedValueOnce([block]);

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

  it('returns session with pages when token is valid', async () => {
    const fakeSession = { id: 1, teamId: 10, status: 'published', sessionToken: 'valid-token', title: 'Test' };
    const page = { id: 10, sessionId: 1, position: 1, title: 'Intro', pageType: 'intro' };

    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy
      .mockResolvedValueOnce([page])
      .mockResolvedValueOnce([]); // blocks

    const { getSessionByToken } = await import('./sessions');
    const result = await getSessionByToken('valid-token');

    expect(result).not.toBeNull();
    expect(result?.sessionToken).toBe('valid-token');
    expect(result?.pages).toHaveLength(1);
  });

  it('returns session with empty pages when no pages exist', async () => {
    const fakeSession = { id: 2, status: 'published', sessionToken: 'tok', title: 'Empty' };
    mockLimit.mockResolvedValueOnce([fakeSession]);
    mockOrderBy.mockResolvedValueOnce([]); // no pages → no block query

    const { getSessionByToken } = await import('./sessions');
    const result = await getSessionByToken('tok');

    expect(result?.pages).toEqual([]);
  });
});
