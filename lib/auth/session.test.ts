// @vitest-environment node
// jose v6 utilise le WebCrypto API de jsdom qui crée un conflit de realm Uint8Array.
// L'environnement node utilise la crypto native de Node.js correctement.
import { describe, it, expect } from 'vitest';
// AUTH_SECRET est injecté par vitest.config.ts → env → disponible au chargement du module
import { hashPassword, comparePasswords, signToken, verifyToken } from './session';

describe('hashPassword / comparePasswords', () => {
  it('hache un mot de passe et le vérifie correctement', async () => {
    const plain = 'motdepasse123';
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    expect(hashed.startsWith('$2')).toBe(true); // préfixe bcrypt

    const isValid = await comparePasswords(plain, hashed);
    expect(isValid).toBe(true);
  });

  it('rejette un mauvais mot de passe', async () => {
    const hashed = await hashPassword('bonmotdepasse');
    const isValid = await comparePasswords('mauvais', hashed);
    expect(isValid).toBe(false);
  });

  it('produit des hachages différents pour le même mot de passe (salt)', async () => {
    const plain = 'memepassword';
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    // bcrypt salt → hachages différents mais les deux valides
    expect(hash1).not.toBe(hash2);
    expect(await comparePasswords(plain, hash1)).toBe(true);
    expect(await comparePasswords(plain, hash2)).toBe(true);
  });
});

describe('signToken / verifyToken', () => {
  it('signe et vérifie un token JWT valide', async () => {
    const payload = {
      user: { id: 42 },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };

    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // header.payload.signature

    const verified = await verifyToken(token);
    expect(verified.user.id).toBe(42);
  });

  it('rejette un token falsifié', async () => {
    const payload = {
      user: { id: 99 },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };

    const token = await signToken(payload);

    // Modifier le dernier caractère invalide la signature
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it("le token contient l'id utilisateur dans le payload", async () => {
    const userId = 123;
    const token = await signToken({
      user: { id: userId },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });

    const decoded = await verifyToken(token);
    expect(decoded.user.id).toBe(userId);
  });
});
