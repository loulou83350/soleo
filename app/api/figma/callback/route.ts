import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/dashboard/general`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // CSRF check
  const cookieStore = await cookies();
  const savedState = cookieStore.get('figma_oauth_state')?.value;
  cookieStore.delete('figma_oauth_state');

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?figma=error`);
  }

  if (!state || state !== savedState) {
    return NextResponse.redirect(`${settingsUrl}?figma=invalid_state`);
  }

  // Exchange authorization code for tokens
  const redirectUri = `${baseUrl}/api/figma/callback`;
  const tokenRes = await fetch('https://www.figma.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID!,
      client_secret: process.env.FIGMA_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('Figma token exchange failed:', await tokenRes.text());
    return NextResponse.redirect(`${settingsUrl}?figma=token_error`);
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Save tokens to team
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${baseUrl}/sign-in`);

  const teamMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
  });

  if (!teamMember) {
    return NextResponse.redirect(`${settingsUrl}?figma=no_team`);
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000);

  await db
    .update(teams)
    .set({
      figmaAccessToken: access_token,
      figmaRefreshToken: refresh_token,
      figmaTokenExpiresAt: expiresAt,
    })
    .where(eq(teams.id, teamMember.teamId));

  return NextResponse.redirect(`${settingsUrl}?figma=connected`);
}
