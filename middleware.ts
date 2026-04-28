import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

/**
 * Routes publiques — bypasser l'authentification complètement.
 * - /s/[token]         → session participant (pas de compte requis)
 * - /findings/[token]  → vue findings pour viewers (pas de compte requis)
 * - /sign-in, /sign-up → pages auth publiques
 */
const PUBLIC_PREFIXES = ['/s/', '/findings/'];
const PUBLIC_EXACT = ['/sign-in', '/sign-up'];

/**
 * Routes protégées qui nécessitent un JWT valide.
 */
const PROTECTED_PREFIXES = ['/dashboard'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Tier 3 — Routes publiques : participants et viewers
  // Aucun contrôle d'auth — laisser passer sans modification
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session');

  // Tier 1 — Routes protégées : chercheurs (JWT requis)
  if (isProtectedRoute(pathname) && !sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Rafraîchissement du cookie JWT sur les GET (prolonger la session)
  let res = NextResponse.next();

  if (sessionCookie && request.method === 'GET') {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          ...parsed,
          expires: expiresInOneDay.toISOString(),
        }),
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        expires: expiresInOneDay,
      });
    } catch (_error) {
      res.cookies.delete('session');
      if (isProtectedRoute(pathname)) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs',
};
