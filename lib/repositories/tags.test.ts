// @vitest-environment node
//
// Tests pour `attachTag` — vérifie que :
// 1. L'insert utilise onConflictDoNothing (relies on UNIQUE(response_id, tag_id)
//    constraint added in migration 0010_missing_unique_constraints).
// 2. La cross-team isolation est respectée (response + tag scoped to team).
//
// Pattern : on mock @/lib/db/drizzle et server-only, puis on stub la chaîne
// SELECT côté `assertResponseInTeam` (from → innerJoin → innerJoin → where →
// limit) et côté tag check (from → where → limit).

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('server-only', () => ({}));

import { db } from '@/lib/db/drizzle';

// ─── Chain builders ─────────────────────────────────────────────────────────

/** assertResponseInTeam: from → innerJoin → innerJoin → where → limit */
function buildAssertChain(returnValue: unknown[]) {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn(() => ({ limit }));
  const innerJoin2 = vi.fn(() => ({ where }));
  const innerJoin1 = vi.fn(() => ({ innerJoin: innerJoin2 }));
  const from = vi.fn(() => ({ innerJoin: innerJoin1 }));
  return { from };
}

/** Tag-in-team check: from → where → limit */
function buildTagCheckChain(returnValue: unknown[]) {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from };
}

/**
 * Insert: values(...) → onConflictDoNothing()
 * Captures the values passed to insert for assertion.
 */
function buildInsertChain() {
  const captured: { value: Record<string, unknown> | null } = { value: null };
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn((v: Record<string, unknown>) => {
    captured.value = v;
    return { onConflictDoNothing };
  });
  return { values, onConflictDoNothing, captured };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('attachTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insère le tag avec onConflictDoNothing (relies on UNIQUE(response_id, tag_id))', async () => {
    const assertChain = buildAssertChain([{ id: 1 }]); // response in team
    const tagChain = buildTagCheckChain([{ id: 99 }]); // tag in team
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: assertChain.from } as unknown as ReturnType<
        typeof db.select
      >)
      .mockReturnValueOnce({ from: tagChain.from } as unknown as ReturnType<
        typeof db.select
      >);

    const insertChain = buildInsertChain();
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: insertChain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { attachTag } = await import('./tags');
    await attachTag({ responseId: 1, tagId: 99, source: 'manual', teamId: 42 });

    expect(db.insert).toHaveBeenCalled();
    expect(insertChain.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('absorbe les doublons silencieusement (onConflictDoNothing résout sans throw)', async () => {
    // Simulates the case where the same (responseId, tagId) row already
    // exists in DB: in Postgres, ON CONFLICT DO NOTHING returns 0 rows
    // affected and no error. Our wrapper should therefore complete normally.
    const assertChain = buildAssertChain([{ id: 1 }]);
    const tagChain = buildTagCheckChain([{ id: 99 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: assertChain.from } as unknown as ReturnType<
        typeof db.select
      >)
      .mockReturnValueOnce({ from: tagChain.from } as unknown as ReturnType<
        typeof db.select
      >);

    const insertChain = buildInsertChain();
    insertChain.onConflictDoNothing.mockResolvedValueOnce(undefined);
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: insertChain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { attachTag } = await import('./tags');
    await expect(
      attachTag({ responseId: 1, tagId: 99, source: 'manual', teamId: 42 })
    ).resolves.toBeUndefined();
  });

  it('passe les bonnes valeurs à values() pour source=manual', async () => {
    const assertChain = buildAssertChain([{ id: 1 }]);
    const tagChain = buildTagCheckChain([{ id: 99 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: assertChain.from } as unknown as ReturnType<
        typeof db.select
      >)
      .mockReturnValueOnce({ from: tagChain.from } as unknown as ReturnType<
        typeof db.select
      >);

    const insertChain = buildInsertChain();
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: insertChain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { attachTag } = await import('./tags');
    await attachTag({
      responseId: 1,
      tagId: 99,
      source: 'manual',
      teamId: 42,
    });

    expect(insertChain.captured.value).toEqual({
      responseId: 1,
      tagId: 99,
      source: 'manual',
    });
  });

  it('passe les bonnes valeurs à values() pour source=ai_auto', async () => {
    const assertChain = buildAssertChain([{ id: 1 }]);
    const tagChain = buildTagCheckChain([{ id: 99 }]);
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: assertChain.from } as unknown as ReturnType<
        typeof db.select
      >)
      .mockReturnValueOnce({ from: tagChain.from } as unknown as ReturnType<
        typeof db.select
      >);

    const insertChain = buildInsertChain();
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: insertChain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { attachTag } = await import('./tags');
    await attachTag({
      responseId: 1,
      tagId: 99,
      source: 'ai_auto',
      teamId: 42,
    });

    expect(insertChain.captured.value).toEqual({
      responseId: 1,
      tagId: 99,
      source: 'ai_auto',
    });
  });

  it('rejette si la réponse n\'appartient pas à la team (cross-team)', async () => {
    const assertChain = buildAssertChain([]); // response NOT in team
    vi.mocked(db.select).mockReturnValueOnce(
      { from: assertChain.from } as unknown as ReturnType<typeof db.select>
    );

    const { attachTag } = await import('./tags');
    await expect(
      attachTag({ responseId: 1, tagId: 99, source: 'manual', teamId: 42 })
    ).rejects.toThrow(/Response not in team/);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejette si le tag n\'appartient pas à la team (cross-team)', async () => {
    const assertChain = buildAssertChain([{ id: 1 }]); // response in team
    const tagChain = buildTagCheckChain([]); // tag NOT in team
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: assertChain.from } as unknown as ReturnType<
        typeof db.select
      >)
      .mockReturnValueOnce({ from: tagChain.from } as unknown as ReturnType<
        typeof db.select
      >);

    const { attachTag } = await import('./tags');
    await expect(
      attachTag({ responseId: 1, tagId: 99, source: 'manual', teamId: 42 })
    ).rejects.toThrow(/Tag not in team/);

    expect(db.insert).not.toHaveBeenCalled();
  });
});
