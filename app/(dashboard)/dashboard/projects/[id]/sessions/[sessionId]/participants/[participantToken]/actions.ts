'use server';

import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  createTag,
  attachTag,
  detachTag,
  findOrCreateTagByLabel,
  listTeamTags,
} from '@/lib/repositories/tags';
import {
  pinHighlight,
  unpinHighlight,
} from '@/lib/repositories/findings';
import { db } from '@/lib/db/drizzle';
import {
  blockResponses,
  sessionBlocks,
  participantSessions,
  sessions,
} from '@/lib/db/schema';
import {
  suggestTagsForResponse,
  type AIProvider,
  type TagSuggestion,
} from '@/lib/ai/providers';
import type { ActionResult } from '@/lib/domain/types';
import type { InsightTag } from '@/lib/db/schema';

// Curated palette — 10 tokens. Kept in sync with TagChip.
// Cannot be `export`ed: 'use server' files only allow async function exports.
const TAG_COLORS = [
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'indigo',
  'purple',
  'pink',
] as const;

// ─── Manual CRUD ─────────────────────────────────────────────────────────────

export async function createTagAction(
  label: string,
  color: string
): Promise<ActionResult<{ tag: InsightTag }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  const cleanLabel = label.trim();
  if (!cleanLabel) return { success: false, error: 'Libellé requis' };
  if (cleanLabel.length > 100) return { success: false, error: 'Libellé trop long' };

  const safeColor = (TAG_COLORS as readonly string[]).includes(color) ? color : 'gray';

  const tag = await createTag({
    teamId: userWithTeam.teamId,
    userId: user.id,
    label: cleanLabel,
    color: safeColor,
  });
  return { success: true, data: { tag } };
}

export async function attachTagAction(
  responseId: number,
  tagId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await attachTag({
      responseId,
      tagId,
      source: 'manual',
      teamId: userWithTeam.teamId,
    });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible d\'attacher le tag' };
  }
}

export async function detachTagAction(
  responseId: number,
  tagId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await detachTag({
      responseId,
      tagId,
      teamId: userWithTeam.teamId,
    });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de retirer le tag' };
  }
}

// ─── AI-assisted suggestion (manual on-demand) ───────────────────────────────

export async function suggestTagsAction(
  responseId: number,
  providerOverride?: AIProvider
): Promise<ActionResult<{ suggestions: TagSuggestion[] }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  // Look up the response + its block + ENFORCE team isolation via JOINs
  const [row] = await db
    .select({
      value: blockResponses.value,
      blockType: sessionBlocks.blockType,
      blockConfig: sessionBlocks.config,
    })
    .from(blockResponses)
    .innerJoin(sessionBlocks, eq(blockResponses.blockId, sessionBlocks.id))
    .innerJoin(
      participantSessions,
      eq(blockResponses.participantSessionId, participantSessions.id)
    )
    .innerJoin(sessions, eq(participantSessions.sessionId, sessions.id))
    .where(
      and(
        eq(blockResponses.id, responseId),
        eq(sessions.teamId, userWithTeam.teamId)
      )
    )
    .limit(1);

  if (!row) return { success: false, error: 'Réponse introuvable' };

  // Extract a textual representation of the response
  const responseText = stringifyResponseForAI(row.blockType, row.value);
  if (!responseText.trim()) {
    return { success: true, data: { suggestions: [] } };
  }

  const config = (row.blockConfig ?? {}) as Record<string, unknown>;
  const question =
    typeof config.question === 'string' ? (config.question as string) : undefined;

  // Existing tags from the team's library (for reuse hint)
  const teamTags = await listTeamTags(userWithTeam.teamId);
  const existingLabels = teamTags.map((t) => t.label);

  try {
    const suggestions = await suggestTagsForResponse({
      responseText,
      blockType: row.blockType,
      question,
      existingTags: existingLabels,
      provider: providerOverride,
    });
    return { success: true, data: { suggestions } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur IA',
    };
  }
}

/**
 * Accepts a single AI-suggested label: finds-or-creates the tag, then
 * attaches it with source='ai_suggested'. Used by the TagEditor when the
 * researcher clicks "Accepter" on a proposed chip.
 */
export async function acceptSuggestedTagAction(
  responseId: number,
  label: string,
  color: string = 'gray'
): Promise<ActionResult<{ tag: InsightTag }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  const cleanLabel = label.trim();
  if (!cleanLabel) return { success: false, error: 'Libellé requis' };
  const safeColor = (TAG_COLORS as readonly string[]).includes(color) ? color : 'gray';

  try {
    const tag = await findOrCreateTagByLabel({
      teamId: userWithTeam.teamId,
      userId: user.id,
      label: cleanLabel,
      color: safeColor,
    });
    await attachTag({
      responseId,
      tagId: tag.id,
      source: 'ai_suggested',
      teamId: userWithTeam.teamId,
    });
    return { success: true, data: { tag } };
  } catch {
    return { success: false, error: 'Impossible d\'accepter le tag suggéré' };
  }
}

// ─── Cache invalidation helper ───────────────────────────────────────────────

export async function revalidateParticipantPath(
  projectId: number,
  sessionId: number,
  participantToken: string
): Promise<void> {
  revalidatePath(
    `/dashboard/projects/${projectId}/sessions/${sessionId}/participants/${participantToken}`
  );
  revalidatePath(`/dashboard/projects/${projectId}/sessions/${sessionId}`);
}

// ─── Highlights (Story 6.2) ──────────────────────────────────────────────────

export async function pinHighlightAction(
  responseId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await pinHighlight({ responseId, teamId: userWithTeam.teamId });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible d\'épingler la réponse' };
  }
}

export async function unpinHighlightAction(
  responseId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await unpinHighlight({ responseId, teamId: userWithTeam.teamId });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de retirer l\'épingle' };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts a plain-text representation of a stored response value, suitable
 * to feed to a language model. Returns an empty string for non-textual /
 * empty responses.
 */
function stringifyResponseForAI(blockType: string, value: unknown): string {
  if (value == null) return '';
  switch (blockType) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : String(value);
    case 'mcq':
      return Array.isArray(value) ? (value as string[]).join(', ') : '';
    case 'matrix':
      if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, string>)
          .map(([row, col]) => `${row}: ${col}`)
          .join(' | ');
      }
      return '';
    case 'card_sort':
      if (Array.isArray(value)) {
        return (value as Array<{ label?: string }>).map((i) => i.label ?? '').filter(Boolean).join(' > ');
      }
      return '';
    case 'likert':
    case 'rating':
    case 'nps':
      return typeof value === 'number' ? `Note : ${value}` : '';
    case 'prototype_task': {
      const r = value as { completed?: boolean; skipped?: boolean; goalReached?: boolean; manualCompletion?: boolean };
      if (r.skipped) return 'Tâche abandonnée';
      if (r.goalReached) return 'Objectif atteint automatiquement';
      if (r.manualCompletion) return 'Marquée terminée manuellement';
      if (r.completed) return 'Tâche complétée';
      return '';
    }
    default:
      return '';
  }
}
