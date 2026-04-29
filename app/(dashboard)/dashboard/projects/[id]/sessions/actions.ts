'use server';

import { redirect } from 'next/navigation';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import {
  createSession,
  updateSessionTitle,
  getSessionWithPages,
  addPage,
  reorderPages,
} from '@/lib/repositories/sessions';
import {
  CreateSessionSchema,
  UpdateSessionTitleSchema,
  AddPageSchema,
  ReorderPagesSchema,
} from '@/lib/validations/sessions';
import type { ActionResult } from '@/lib/domain/types';
import type { SessionPage } from '@/lib/db/schema';

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

// ─── Add Page ────────────────────────────────────────────────────────────────

/**
 * Inserts a new empty question page after `afterPageId`.
 * Returns the updated ordered page list (without blocks).
 */
export async function addPageAction(
  sessionId: number,
  afterPageId: number
): Promise<ActionResult<{ pages: SessionPage[] }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = AddPageSchema.safeParse({ sessionId, afterPageId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  try {
    const pages = await addPage(sessionId, userWithTeam.teamId, afterPageId);
    return { success: true, data: { pages } };
  } catch {
    return { success: false, error: 'Impossible d\'ajouter la page' };
  }
}

// ─── Reorder Pages ───────────────────────────────────────────────────────────

/**
 * Persists a new page order after drag-and-drop reordering.
 */
export async function reorderPagesAction(
  sessionId: number,
  orderedPageIds: number[]
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = ReorderPagesSchema.safeParse({ sessionId, orderedPageIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  try {
    await reorderPages(sessionId, userWithTeam.teamId, orderedPageIds);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de réordonner les pages' };
  }
}
