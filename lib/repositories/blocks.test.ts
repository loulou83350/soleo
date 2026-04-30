// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
let insertCallCount = 0;
const insertReturns: Array<unknown> = [];

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: mockLimit,
        orderBy: mockOrderBy,
      })),
      innerJoin: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: mockLimit,
          })),
        })),
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
  })),
  insert: vi.fn(() => {
    const callIdx = insertCallCount++;
    return {
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(insertReturns[callIdx] ?? [])),
      })),
    };
  }),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
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
  max: vi.fn(() => 'max'),
  asc: vi.fn(() => 'asc'),
  inArray: vi.fn(() => 'inArray'),
  sql: vi.fn(() => 'sql'),
}));
vi.mock('@/lib/domain/blocks', () => ({
  BLOCK_DEFAULTS: {
    welcome:          { title: '', description: '', buttonText: 'Commencer' },
    thank_you:        { title: 'Merci !', description: '' },
    short_text:       { question: '', placeholder: '' },
    long_text:        { question: '', placeholder: '', aiFollowUp: false, maxTurns: 1 },
    mcq:              { question: '', options: ['', '', '', ''], allowMultiple: false, randomize: false, allowOther: false },
    likert:           { question: '', scale: 5, lowLabel: "Pas du tout d'accord", highLabel: "Tout à fait d'accord" },
    rating:           { question: '', max: 5 },
    nps:              { question: '', lowLabel: 'Pas du tout probable', highLabel: 'Très probable' },
    card_sort:        { question: '', items: [{ label: '' }, { label: '' }, { label: '' }] },
    matrix:           { question: '', rows: ['', ''], columns: ['', '', ''] },
    first_impression: { imageUrl: '', duration: 5, instructions: '' },
    prototype_task:   { url: '', instructions: '' },
  },
  ANCHOR_BLOCK_TYPES: ['welcome', 'thank_you'],
}));

// ─── addBlock ─────────────────────────────────────────────────────────────────

describe('addBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCallCount = 0;
    insertReturns.length = 0;
    vi.resetModules();
  });

  it('throws when session does not belong to team', async () => {
    // session lookup returns nothing
    mockLimit.mockResolvedValue([]);
    const { addBlock } = await import('./blocks');
    await expect(addBlock(1, 10, 999, 'short_text')).rejects.toThrow('Session introuvable');
  });

  it('inserts a block with correct defaults and returns it', async () => {
    const fakeSession = { id: 1, teamId: 10 };
    const fakeAfterBlock = { id: 999, sessionId: 1, position: 2, blockType: 'short_text' };
    const fakeBlock = { id: 2, sessionId: 1, position: 3, blockType: 'short_text', config: { question: '', placeholder: '' }, required: false };

    mockLimit
      .mockResolvedValueOnce([fakeSession])  // session lookup
      .mockResolvedValueOnce([fakeAfterBlock]); // afterBlock lookup
    insertReturns.push([fakeBlock]);

    const { addBlock } = await import('./blocks');
    const result = await addBlock(1, 10, 999, 'short_text');

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(fakeBlock);
  });
});

// ─── updateBlock ──────────────────────────────────────────────────────────────

describe('updateBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when block does not belong to team', async () => {
    mockLimit.mockResolvedValue([]); // getBlockWithSession returns nothing
    const { updateBlock } = await import('./blocks');
    await expect(updateBlock(1, 10, { required: true })).rejects.toThrow('Bloc introuvable');
  });

  it('calls db.update when team matches', async () => {
    mockLimit.mockResolvedValue([{ block: { id: 1 }, teamId: 10, sessionPageId: 100 }]);
    const { updateBlock } = await import('./blocks');
    await updateBlock(1, 10, { required: true });
    expect(mockDb.update).toHaveBeenCalledOnce();
  });
});

// ─── deleteBlock ──────────────────────────────────────────────────────────────

describe('deleteBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when block does not belong to team', async () => {
    mockLimit.mockResolvedValue([]);
    const { deleteBlock } = await import('./blocks');
    await expect(deleteBlock(1, 10)).rejects.toThrow('Bloc introuvable');
  });

  it('calls db.delete when team matches', async () => {
    mockLimit.mockResolvedValue([{ block: { id: 1 }, teamId: 10, sessionPageId: 100 }]);
    const { deleteBlock } = await import('./blocks');
    await deleteBlock(1, 10);
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });
});

// ─── reorderBlocks ────────────────────────────────────────────────────────────

describe('reorderSessionBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('throws when session does not belong to team', async () => {
    mockLimit.mockResolvedValue([]);
    const { reorderSessionBlocks } = await import('./blocks');
    await expect(reorderSessionBlocks(1, 10, [1, 2, 3])).rejects.toThrow('Session introuvable');
  });

  it('calls db.update for each block in orderedBlockIds', async () => {
    mockLimit.mockResolvedValue([{ teamId: 10 }]);
    const { reorderSessionBlocks } = await import('./blocks');
    await reorderSessionBlocks(100, 10, [1, 2, 3]);
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });
});
