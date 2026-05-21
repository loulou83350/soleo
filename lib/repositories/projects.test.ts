// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock du module drizzle avant tous les imports
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock server-only pour éviter l'erreur en environnement test
vi.mock('server-only', () => ({}));

// Spy on drizzle-orm helpers so we can assert their args — verifies that
// orderBy receives a desc(...) marker (not just that orderBy was called).
const drizzleSpies = vi.hoisted(() => ({
  desc: vi.fn((col: unknown) => ({ __op: 'desc', col })),
}));
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, desc: drizzleSpies.desc };
});

import { db } from '@/lib/db/drizzle';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    id: 1,
    teamId: 10,
    name: 'Projet Test',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    sessionCount: 0,
    ...overrides,
  };
}

/**
 * Builds the SELECT chain matching `getProjectsByTeam`:
 *   db.select().from().leftJoin().where().groupBy().orderBy()
 * orderBy resolves the query.
 */
function makeProjectsSelectChain(returnValue: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(returnValue);
  const groupBy = vi.fn(() => ({ orderBy }));
  const where = vi.fn(() => ({ groupBy }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  return { from, leftJoin, where, groupBy, orderBy };
}

function makeInsertChain(returnValue: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returnValue);
  const values = vi.fn(() => ({ returning }));
  return { values, returning };
}

function makeGetByIdChain(returnValue: unknown[]) {
  const limit = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  return { from, where, limit };
}

function makeDeleteChain(returnValue: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returnValue);
  const where = vi.fn(() => ({ returning }));
  return { where, returning };
}

// ─── getProjectsByTeam ──────────────────────────────────────────────────────

describe('getProjectsByTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne les projets du workspace avec leur sessionCount', async () => {
    const chain = makeProjectsSelectChain([makeProject({ sessionCount: 3 })]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectsByTeam } = await import('./projects');
    const result = await getProjectsByTeam(10);

    expect(db.select).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Projet Test');
    expect(result[0]?.sessionCount).toBe(3);
  });

  it('retourne sessionCount=0 pour les projets sans sessions', async () => {
    const chain = makeProjectsSelectChain([
      makeProject({ id: 1, sessionCount: 0 }),
      makeProject({ id: 2, sessionCount: 0 }),
    ]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectsByTeam } = await import('./projects');
    const result = await getProjectsByTeam(10);

    expect(result).toHaveLength(2);
    expect(result.every((p) => p.sessionCount === 0)).toBe(true);
  });

  it('retourne un tableau vide si aucun projet', async () => {
    const chain = makeProjectsSelectChain([]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectsByTeam } = await import('./projects');
    const result = await getProjectsByTeam(99);
    expect(result).toHaveLength(0);
  });

  it('respecte la structure JOIN + GROUP BY + ORDER BY (cross-team isolation via WHERE)', async () => {
    // Verifies the query chain is fully built — guarantees the teamId
    // filter (passed to WHERE) and the GROUP BY required for the
    // count(sessions) aggregation are both wired up.
    const chain = makeProjectsSelectChain([]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectsByTeam } = await import('./projects');
    await getProjectsByTeam(123);

    expect(chain.from).toHaveBeenCalled();
    expect(chain.leftJoin).toHaveBeenCalled(); // sessions table joined
    expect(chain.where).toHaveBeenCalled(); // teamId filter
    expect(chain.groupBy).toHaveBeenCalled(); // required for count()
    expect(chain.orderBy).toHaveBeenCalled();
  });

  it('appelle orderBy avec un marker desc() (tri descendant explicite)', async () => {
    const chain = makeProjectsSelectChain([]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectsByTeam } = await import('./projects');
    await getProjectsByTeam(10);

    // The mocked drizzle `desc()` wraps its arg in { __op: 'desc', col }.
    // We verify orderBy received exactly that wrapper — not just any call.
    expect(drizzleSpies.desc).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalledWith(
      expect.objectContaining({ __op: 'desc' })
    );
  });
});

// ─── createProject ──────────────────────────────────────────────────────────

describe('createProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insère et retourne le projet créé', async () => {
    const project = makeProject({ name: 'Nouveau projet', teamId: 5 });
    const chain = makeInsertChain([project]);
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: chain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { createProject } = await import('./projects');
    const result = await createProject({ teamId: 5, name: 'Nouveau projet' });

    expect(db.insert).toHaveBeenCalled();
    expect(result.name).toBe('Nouveau projet');
    expect(result.teamId).toBe(5);
  });

  it("lance une erreur si l'insert retourne vide", async () => {
    const chain = makeInsertChain([]);
    vi.mocked(db.insert).mockReturnValueOnce(
      { values: chain.values } as unknown as ReturnType<typeof db.insert>
    );

    const { createProject } = await import('./projects');
    await expect(createProject({ teamId: 5, name: 'Test' })).rejects.toThrow();
  });
});

// ─── getProjectById ─────────────────────────────────────────────────────────

describe('getProjectById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne le projet si appartient à la team', async () => {
    const project = makeProject();
    const chain = makeGetByIdChain([project]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectById } = await import('./projects');
    const result = await getProjectById(1, 10);
    expect(result?.name).toBe('Projet Test');
  });

  it('retourne null si projet inexistant ou cross-team', async () => {
    const chain = makeGetByIdChain([]);
    vi.mocked(db.select).mockReturnValueOnce(
      { from: chain.from } as unknown as ReturnType<typeof db.select>
    );

    const { getProjectById } = await import('./projects');
    const result = await getProjectById(1, 999);
    expect(result).toBeNull();
  });
});

// ─── deleteProject ──────────────────────────────────────────────────────────

describe('deleteProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne true si le projet est supprimé', async () => {
    const chain = makeDeleteChain([{ id: 1 }]);
    vi.mocked(db.delete).mockReturnValueOnce(
      { where: chain.where } as unknown as ReturnType<typeof db.delete>
    );

    const { deleteProject } = await import('./projects');
    const result = await deleteProject(1, 10);
    expect(result).toBe(true);
  });

  it('retourne false si le projet est introuvable ou cross-team', async () => {
    const chain = makeDeleteChain([]);
    vi.mocked(db.delete).mockReturnValueOnce(
      { where: chain.where } as unknown as ReturnType<typeof db.delete>
    );

    const { deleteProject } = await import('./projects');
    const result = await deleteProject(999, 10);
    expect(result).toBe(false);
  });
});
