import { describe, it, expect } from 'vitest';
import { CreateProjectSchema, DeleteProjectSchema } from './projects';

describe('CreateProjectSchema', () => {
  it('accepte un nom valide', () => {
    const result = CreateProjectSchema.safeParse({ name: 'Projet Alpha' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Projet Alpha');
    }
  });

  it('trim le nom (espaces en début/fin)', () => {
    const result = CreateProjectSchema.safeParse({ name: '  Mon projet  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Mon projet');
    }
  });

  it('rejette un nom vide', () => {
    const result = CreateProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('requis');
    }
  });

  it('rejette un nom trop long (> 100 caractères)', () => {
    const longName = 'A'.repeat(101);
    const result = CreateProjectSchema.safeParse({ name: longName });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('100');
    }
  });

  it('accepte un nom exactement de 100 caractères', () => {
    const exactName = 'B'.repeat(100);
    const result = CreateProjectSchema.safeParse({ name: exactName });
    expect(result.success).toBe(true);
  });
});

describe('DeleteProjectSchema', () => {
  it('accepte un projectId entier positif', () => {
    const result = DeleteProjectSchema.safeParse({ projectId: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(42);
    }
  });

  it('rejette un projectId nul', () => {
    const result = DeleteProjectSchema.safeParse({ projectId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejette un projectId négatif', () => {
    const result = DeleteProjectSchema.safeParse({ projectId: -1 });
    expect(result.success).toBe(false);
  });

  it('rejette un projectId non-entier', () => {
    const result = DeleteProjectSchema.safeParse({ projectId: 1.5 });
    expect(result.success).toBe(false);
  });
});
