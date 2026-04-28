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

import { db } from '@/lib/db/drizzle';

// Helpers pour créer des faux projets
function makeProject(overrides = {}) {
  return {
    id: 1,
    teamId: 10,
    name: 'Projet Test',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── Type pour le mock du query builder ─────────────────────────────────────

type MockQueryBuilder = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
};

function makeSelectChain(returnValue: unknown[]): MockQueryBuilder {
  const chain: MockQueryBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(returnValue);
  chain.limit.mockResolvedValue(returnValue);
  return chain;
}

function makeInsertChain(returnValue: unknown[]): MockQueryBuilder {
  const chain: MockQueryBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
  };
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returnValue);
  return chain;
}

function makeDeleteChain(returnValue: unknown[]): MockQueryBuilder {
  const chain: MockQueryBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(returnValue);
  return chain;
}

describe('getProjectsByTeam', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne les projets du workspace', async () => {
    const project = makeProject();
    const chain = makeSelectChain([project]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getProjectsByTeam } = await import('./projects');
    const result = await getProjectsByTeam(10);

    expect(db.select).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Projet Test');
  });

  it('retourne un tableau vide si aucun projet', async () => {
    const chain = makeSelectChain([]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const { getProjectsByTeam } = await import('./projects');
    const result = await getProjectsByTeam(99);
    expect(result).toHaveLength(0);
  });
});

describe('createProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('insère et retourne le projet créé', async () => {
    const project = makeProject({ name: 'Nouveau projet', teamId: 5 });
    const chain = makeInsertChain([project]);
    vi.mocked(db.insert).mockReturnValue(chain as unknown as ReturnType<typeof db.insert>);

    const { createProject } = await import('./projects');
    const result = await createProject({ teamId: 5, name: 'Nouveau projet' });

    expect(db.insert).toHaveBeenCalled();
    expect(result.name).toBe('Nouveau projet');
    expect(result.teamId).toBe(5);
  });

  it('lance une erreur si l\'insert retourne vide', async () => {
    const chain = makeInsertChain([]);
    vi.mocked(db.insert).mockReturnValue(chain as unknown as ReturnType<typeof db.insert>);

    const { createProject } = await import('./projects');
    await expect(createProject({ teamId: 5, name: 'Test' })).rejects.toThrow();
  });
});

describe('deleteProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retourne true si le projet est supprimé', async () => {
    const chain = makeDeleteChain([{ id: 1 }]);
    vi.mocked(db.delete).mockReturnValue(chain as unknown as ReturnType<typeof db.delete>);

    const { deleteProject } = await import('./projects');
    const result = await deleteProject(1, 10);
    expect(result).toBe(true);
  });

  it('retourne false si le projet est introuvable', async () => {
    const chain = makeDeleteChain([]);
    vi.mocked(db.delete).mockReturnValue(chain as unknown as ReturnType<typeof db.delete>);

    const { deleteProject } = await import('./projects');
    const result = await deleteProject(999, 10);
    expect(result).toBe(false);
  });
});
