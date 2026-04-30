// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Stubs (vi.hoisted so factory sees them at hoist time) ───────────────────

const mocks = vi.hoisted(() => {
  const mockOnConflictDoUpdate = vi.fn();
  const mockReturning = vi.fn();
  const mockLimit = vi.fn();

  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockReturning,
        onConflictDoUpdate: mockOnConflictDoUpdate,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };

  return { mockDb, mockOnConflictDoUpdate, mockReturning, mockLimit };
});

vi.mock('@/lib/db/drizzle', () => ({ db: mocks.mockDb }));
vi.mock('@/lib/db/schema', () => ({
  participantSessions: {},
  blockResponses: {},
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
}));

// ─── Subject ──────────────────────────────────────────────────────────────────

import {
  startParticipantSession,
  getParticipantSession,
  completeParticipantSession,
  upsertBlockResponse,
  getBlockResponses,
} from './participant-sessions';

// ─── Convenience aliases ──────────────────────────────────────────────────────

const { mockDb, mockOnConflictDoUpdate, mockReturning, mockLimit } = mocks;

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startParticipantSession', () => {
  it('inserts a new row and returns it', async () => {
    const fakeRow = {
      id: 1,
      sessionId: 42,
      participantToken: 'abc123',
      status: 'in_progress',
      startedAt: new Date(),
      completedAt: null,
    };
    mockReturning.mockResolvedValueOnce([fakeRow]);

    const result = await startParticipantSession(42);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(result).toEqual(fakeRow);
  });

  it('generates a participantToken with no dashes', async () => {
    let capturedValues: Record<string, unknown> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockDb.insert as any).mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        capturedValues = v;
        return { returning: mockReturning };
      },
    });
    mockReturning.mockResolvedValueOnce([{ id: 1, participantToken: 'tok' }]);

    await startParticipantSession(99);

    expect(capturedValues).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (capturedValues as unknown as { participantToken: string }).participantToken;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(token).not.toContain('-');
  });
});

describe('getParticipantSession', () => {
  it('returns the row when found', async () => {
    const fakeRow = { id: 5, participantToken: 'tok123', sessionId: 1, status: 'in_progress' };
    mockLimit.mockResolvedValueOnce([fakeRow]);

    const result = await getParticipantSession('tok123');
    expect(result).toEqual(fakeRow);
  });

  it('returns null when not found', async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await getParticipantSession('nonexistent');
    expect(result).toBeNull();
  });
});

describe('completeParticipantSession', () => {
  it('updates status to completed and sets completedAt', async () => {
    const mockWhere = vi.fn().mockResolvedValueOnce(undefined);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockDb.update as any).mockReturnValueOnce({ set: mockSet });

    await completeParticipantSession(7);

    expect(mockDb.update).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setArg = (mockSet.mock.calls as any)[0]?.[0] as { status: string; completedAt: unknown };
    expect(setArg?.status).toBe('completed');
    expect(setArg?.completedAt).toBeInstanceOf(Date);
  });
});

describe('upsertBlockResponse', () => {
  it('calls insert with onConflictDoUpdate and returns the row', async () => {
    const fakeRow = {
      id: 10,
      participantSessionId: 1,
      blockId: 3,
      value: { text: 'hello' },
      answeredAt: new Date(),
    };
    mockOnConflictDoUpdate.mockReturnValueOnce({ returning: mockReturning });
    mockReturning.mockResolvedValueOnce([fakeRow]);

    const result = await upsertBlockResponse(1, 3, { text: 'hello' });

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.any(Object) })
    );
    expect(result).toEqual(fakeRow);
  });
});

describe('getBlockResponses', () => {
  it('returns all responses for a participant session', async () => {
    const fakeRows = [
      { id: 1, blockId: 2, value: 'a', participantSessionId: 99 },
      { id: 2, blockId: 3, value: 'b', participantSessionId: 99 },
    ];
    mockDb.select.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValueOnce(fakeRows),
      })),
    });

    const result = await getBlockResponses(99);
    expect(result).toEqual(fakeRows);
    expect(result).toHaveLength(2);
  });
});
