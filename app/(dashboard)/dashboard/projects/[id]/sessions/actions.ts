'use server';

import { redirect } from 'next/navigation';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import {
  createSession,
  updateSessionTitle,
  getSessionWithPages,
} from '@/lib/repositories/sessions';
import { CreateSessionSchema, UpdateSessionTitleSchema } from '@/lib/validations/sessions';
import type { ActionResult } from '@/lib/domain/types';

// ─── Create Session ──────────────────────────────────────────────────────────

/**
 * Creates a new session in a project, then redirects to the builder.
 * Accepts FormData so it can be used directly as a <form action>.
 */
export async function createSessionAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) redirect('/sign-in');

  const rawProjectId = formData.get('projectId');
  const projectId = rawProjectId ? parseInt(String(rawProjectId), 10) : NaN;

  // Validate input
  const parsed = CreateSessionSchema.safeParse({ projectId });
  if (!parsed.success) redirect('/dashboard');

  // Verify project belongs to team
  const project = await getProjectById(projectId, userWithTeam.teamId);
  if (!project) redirect('/dashboard');

  const session = await createSession(userWithTeam.teamId, projectId);

  redirect(
    `/dashboard/projects/${projectId}/sessions/${session.id}/builder`
  );
}

// ─── Update Session Title ────────────────────────────────────────────────────

/**
 * Auto-save action for the session title in the builder header.
 * Returns success/error — does NOT redirect.
 */
export async function updateSessionTitleAction(
  sessionId: number,
  title: string
): Promise<ActionResult<{ title: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = UpdateSessionTitleSchema.safeParse({ sessionId, title });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  // Verify session belongs to this team (workspace isolation)
  const session = await getSessionWithPages(sessionId, userWithTeam.teamId);
  if (!session) return { success: false, error: 'Session introuvable' };

  await updateSessionTitle(sessionId, userWithTeam.teamId, parsed.data.title);

  return { success: true, data: { title: parsed.data.title } };
}
