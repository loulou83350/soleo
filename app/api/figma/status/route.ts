import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teams, teamMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ connected: false });

  const teamMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: { team: true },
  });

  if (!teamMember?.team?.figmaAccessToken) {
    return Response.json({ connected: false });
  }

  return Response.json({
    connected: true,
    expiresAt: teamMember.team.figmaTokenExpiresAt?.toISOString() ?? null,
  });
}

// Disconnect: clear figma tokens from the team
export async function DELETE() {
  const user = await getUser();
  if (!user) return Response.json({ error: 'Non authentifié' }, { status: 401 });

  const teamMember = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
  });

  if (!teamMember) return Response.json({ error: 'Aucune équipe' }, { status: 404 });

  await db
    .update(teams)
    .set({
      figmaAccessToken: null,
      figmaRefreshToken: null,
      figmaTokenExpiresAt: null,
    })
    .where(eq(teams.id, teamMember.teamId));

  return Response.json({ connected: false });
}
