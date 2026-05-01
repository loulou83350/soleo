'use server';

import { redirect } from 'next/navigation';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import {
  createSession,
  createSessionFromTemplate,
  updateSessionTitle,
  getSessionWithBlocks,
  reorderBlocks,
  deleteSession,
  publishSession,
  setSessionGate,
} from '@/lib/repositories/sessions';
import type { GateConfig } from '@/lib/repositories/sessions';
import { TEMPLATE_MAP } from '@/lib/domain/templates';
import {
  CreateSessionSchema,
  UpdateSessionTitleSchema,
  AddBlockSchema,
  ReorderBlocksSchema,
  UpdateBlockSchema,
  DeleteBlockSchema,
  PublishSessionSchema,
  DeleteSessionSchema,
} from '@/lib/validations/sessions';
import { addBlock, updateBlock, deleteBlock } from '@/lib/repositories/blocks';
import { uploadBlockAsset } from '@/lib/supabase/storage';
import { parseFigmaProtoUrl, fetchFigmaFrames, type FigmaFrame } from '@/lib/figma/api';
import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import type { ActionResult, PublishResult, ValidationIssue } from '@/lib/domain/types';
import type { SessionBlock } from '@/lib/db/schema';

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

  const parsed = CreateSessionSchema.safeParse({ projectId });
  if (!parsed.success) redirect('/dashboard');

  const project = await getProjectById(projectId, userWithTeam.teamId);
  if (!project) redirect('/dashboard');

  const session = await createSession(userWithTeam.teamId, projectId);

  redirect(`/dashboard/projects/${projectId}/sessions/${session.id}/builder`);
}

/**
 * Creates a session from a template and returns the new session ID.
 * Redirect is handled client-side (modal context).
 */
export async function createSessionFromTemplateAction(
  projectId: number,
  templateId: string
): Promise<ActionResult<{ sessionId: number }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const template = TEMPLATE_MAP.get(templateId);
  if (!template) return { success: false, error: 'Template introuvable' };

  const project = await getProjectById(projectId, userWithTeam.teamId);
  if (!project) return { success: false, error: 'Projet introuvable' };

  try {
    const session = await createSessionFromTemplate(userWithTeam.teamId, projectId, template);
    return { success: true, data: { sessionId: session.id } };
  } catch {
    return { success: false, error: 'Erreur lors de la création' };
  }
}

// ─── Update Session Title ────────────────────────────────────────────────────

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

  const session = await getSessionWithBlocks(sessionId, userWithTeam.teamId);
  if (!session) return { success: false, error: 'Session introuvable' };

  await updateSessionTitle(sessionId, userWithTeam.teamId, parsed.data.title);
  return { success: true, data: { title: parsed.data.title } };
}

// ─── Add Block ───────────────────────────────────────────────────────────────

export async function addBlockAction(
  sessionId: number,
  afterBlockId: number,
  blockType: string
): Promise<ActionResult<{ block: SessionBlock }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = AddBlockSchema.safeParse({ sessionId, afterBlockId, blockType });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Type de bloc invalide' };
  }

  try {
    const block = await addBlock(sessionId, userWithTeam.teamId, afterBlockId, parsed.data.blockType);
    return { success: true, data: { block } };
  } catch {
    return { success: false, error: 'Impossible d\'ajouter le bloc' };
  }
}

// ─── Reorder Blocks ──────────────────────────────────────────────────────────

export async function reorderBlocksAction(
  sessionId: number,
  orderedBlockIds: number[]
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = ReorderBlocksSchema.safeParse({ sessionId, orderedBlockIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  try {
    await reorderBlocks(sessionId, userWithTeam.teamId, orderedBlockIds);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de réordonner les blocs' };
  }
}

// ─── Update Block ────────────────────────────────────────────────────────────

export async function updateBlockAction(
  sessionId: number,
  blockId: number,
  updates: { config?: Record<string, unknown>; required?: boolean; conditions?: import('@/lib/domain/types').BlockVisibilityRule }
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = UpdateBlockSchema.safeParse({
    blockId,
    config: updates.config ?? {},
    required: updates.required ?? false,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
  }

  try {
    await updateBlock(blockId, userWithTeam.teamId, updates);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de mettre à jour le bloc' };
  }
}

// ─── Delete Block ────────────────────────────────────────────────────────────

export async function deleteBlockAction(
  sessionId: number,
  blockId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = DeleteBlockSchema.safeParse({ blockId });
  if (!parsed.success) return { success: false, error: 'Données invalides' };

  try {
    await deleteBlock(blockId, userWithTeam.teamId);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Impossible de supprimer le bloc' };
  }
}

// ─── Upload Block Image ──────────────────────────────────────────────────────

export async function uploadBlockImageAction(
  sessionId: number,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { success: false, error: 'Fichier manquant' };

  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) return { success: false, error: 'Fichier trop volumineux (max 5 Mo)' };

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED.includes(file.type)) {
    return { success: false, error: 'Format non supporté (JPEG, PNG, WebP, GIF)' };
  }

  try {
    const url = await uploadBlockAsset(file, userWithTeam.teamId, sessionId);
    return { success: true, data: { url } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur upload';
    return { success: false, error: msg };
  }
}

// ─── Publish Session ─────────────────────────────────────────────────────────

export async function publishSessionAction(sessionId: number): Promise<PublishResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { ok: false, error: 'Aucune équipe trouvée' };

  const parsed = PublishSessionSchema.safeParse({ sessionId });
  if (!parsed.success) return { ok: false, error: 'Données invalides' };

  try {
    const token = await publishSession(sessionId, userWithTeam.teamId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return { ok: true, token, url: `${baseUrl}/s/${token}` };
  } catch (err) {
    if (
      err instanceof Error &&
      'validationIssues' in err &&
      Array.isArray((err as Error & { validationIssues: ValidationIssue[] }).validationIssues)
    ) {
      return {
        ok: false,
        validationIssues: (err as Error & { validationIssues: ValidationIssue[] }).validationIssues,
      };
    }
    const msg = err instanceof Error ? err.message : 'Erreur de publication';
    return { ok: false, error: msg };
  }
}

// ─── Delete Session ───────────────────────────────────────────────────────────

export async function deleteSessionAction(
  sessionId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  const parsed = DeleteSessionSchema.safeParse({ sessionId });
  if (!parsed.success) return { success: false, error: 'Données invalides' };

  try {
    await deleteSession(sessionId, userWithTeam.teamId);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
  }
}

// ─── Gate Configuration (Story 3.5) ──────────────────────────────────────────

export async function updateSessionGateAction(
  sessionId: number,
  gateConfig: GateConfig
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe trouvée' };

  try {
    await setSessionGate(sessionId, userWithTeam.teamId, gateConfig);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur' };
  }
}

// ─── Figma Screen Picker ──────────────────────────────────────────────────────

export async function fetchFigmaFramesAction(
  prototypeUrl: string
): Promise<ActionResult<FigmaFrame[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };

  const { resolveFigmaToken } = await import('@/lib/figma/auth');
  const figmaToken = await resolveFigmaToken(user.id);

  if (!figmaToken) {
    return {
      success: false,
      error:
        'Figma non connecté. Ajoutez votre token Figma dans Paramètres → Intégrations.',
    };
  }

  const parsed = parseFigmaProtoUrl(prototypeUrl);
  if (!parsed) {
    return { success: false, error: 'URL Figma invalide. Collez un lien de prototype Figma.' };
  }

  try {
    const frames = await fetchFigmaFrames(parsed.fileKey, parsed.pageId, figmaToken);

    // Story 9.1 — best-effort enrich with thumbnails (graceful degrade on failure)
    if (frames.length > 0) {
      try {
        const { fetchFigmaThumbnails } = await import('@/lib/figma/api');
        const thumbnails = await fetchFigmaThumbnails(
          parsed.fileKey,
          frames.map((f) => f.id),
          figmaToken
        );
        for (const f of frames) {
          if (thumbnails[f.id]) f.thumbnailUrl = thumbnails[f.id];
        }
      } catch {
        // Frames work without thumbnails — don't fail the whole picker
      }
    }

    return { success: true, data: frames };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erreur Figma API' };
  }
}
