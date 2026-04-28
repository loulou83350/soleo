export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionWithPages } from '@/lib/repositories/sessions';
import { BuilderClient } from '@/components/builder/BuilderClient';

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function BuilderPage({ params }: Props) {
  const { id, sessionId: sessionIdStr } = await params;
  const projectId = parseInt(id, 10);
  const sessionId = parseInt(sessionIdStr, 10);

  if (isNaN(projectId) || isNaN(sessionId)) notFound();

  const user = await getUser();
  if (!user) notFound();

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  // Verify project belongs to team
  const project = await getProjectById(projectId, userWithTeam.teamId);
  if (!project) notFound();

  // Load session with all pages and blocks
  const session = await getSessionWithPages(sessionId, userWithTeam.teamId);
  if (!session) notFound();

  return <BuilderClient session={session} projectId={projectId} />;
}
