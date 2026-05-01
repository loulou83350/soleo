// Server-side helper to resolve a Figma access token for a given user.
// Order: team token (DB) > FIGMA_ACCESS_TOKEN env var (dev fallback).
//
// Used by both the picker server action and the participant detail page
// (Story 9.1 + 9.2) to avoid duplicating the lookup logic.

import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teamMembers } from '@/lib/db/schema';

export async function resolveFigmaToken(userId: number): Promise<string | null> {
  try {
    const teamMember = await db.query.teamMembers.findFirst({
      where: eq(teamMembers.userId, userId),
      with: { team: true },
    });
    if (teamMember?.team?.figmaAccessToken) {
      return teamMember.team.figmaAccessToken;
    }
  } catch {
    // Fall through to env fallback
  }
  return process.env.FIGMA_ACCESS_TOKEN ?? null;
}
