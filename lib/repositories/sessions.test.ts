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
    mockOrderBy
      .mockResolvedValueOnce([]) // pages
      .mockResolvedValueOnce([]); // blocks (skipped since no pages)

    const { getSessionWithPages } = await import('./sessions');
    const result = await getSessionWithPages(1, 10);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.pages).toEqual([]);
  });
});
