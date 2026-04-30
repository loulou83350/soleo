import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_APP_URL));

  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('figma_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/figma/callback`;

  const url = new URL('https://www.figma.com/oauth');
  url.searchParams.set('client_id', process.env.FIGMA_CLIENT_ID!);
  url.searchParams.set('redirect_uri', redirectUri);
  // Figma renamed scopes: 'file_read' → 'files:read' (modern format)
  url.searchParams.set('scope', 'files:read');
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  return NextResponse.redirect(url.toString());
}
