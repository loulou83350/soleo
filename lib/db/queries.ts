import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, invitations, teamMembers, teams, users } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.team || null;
}

// ─── Members & Invitations ─────────────────────────────────────────────────

export type TeamMemberWithUser = {
  id: number;
  role: string;
  joinedAt: Date;
  user: { id: number; name: string | null; email: string };
};

/**
 * Returns all active members of a team (with user details).
 * Ordered by join date ascending (oldest first).
 */
export async function getTeamMembersWithUsers(
  teamId: number
): Promise<TeamMemberWithUser[]> {
  const rows = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(and(eq(teamMembers.teamId, teamId), isNull(users.deletedAt)))
    .orderBy(teamMembers.joinedAt);

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    joinedAt: r.joinedAt,
    user: { id: r.userId, name: r.userName, email: r.userEmail },
  }));
}

export type PendingInvitation = {
  id: number;
  email: string;
  role: string;
  invitedAt: Date;
};

/**
 * Returns all pending invitations for a team.
 * Ordered by invitation date descending (newest first).
 */
export async function getPendingInvitations(
  teamId: number
): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      invitedAt: invitations.invitedAt,
    })
    .from(invitations)
    .where(
      and(eq(invitations.teamId, teamId), eq(invitations.status, 'pending'))
    )
    .orderBy(desc(invitations.invitedAt));

  return rows;
}

/**
 * Returns the current user's role in their team.
 * Returns null if the user is not authenticated or not in a team.
 */
export async function getCurrentUserTeamRole(): Promise<{
  teamId: number;
  role: string;
} | null> {
  const user = await getUser();
  if (!user) return null;

  const [row] = await db
    .select({ teamId: teamMembers.teamId, role: teamMembers.role })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  return row ?? null;
}
