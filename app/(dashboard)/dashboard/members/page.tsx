export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import {
  getCurrentUserTeamRole,
  getTeamMembersWithUsers,
  getPendingInvitations,
} from '@/lib/db/queries';
import { MembersClient } from './members-client';

export default async function MembersPage() {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  const teamRole = await getCurrentUserTeamRole();

  // Only team owners can manage members
  if (!teamRole || teamRole.role !== 'owner') {
    redirect('/dashboard');
  }

  const [members, pendingInvitations] = await Promise.all([
    getTeamMembersWithUsers(teamRole.teamId),
    getPendingInvitations(teamRole.teamId),
  ]);

  return (
    <MembersClient
      currentUserId={user.id}
      initialMembers={members}
      initialInvitations={pendingInvitations}
    />
  );
}
