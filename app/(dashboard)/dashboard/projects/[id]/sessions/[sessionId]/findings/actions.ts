'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import {
  getOrCreateFinding,
  updateFinding,
  publishFinding,
  unpublishFinding,
} from '@/lib/repositories/findings';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  getAllResponsesForSession,
} from '@/lib/repositories/participant-sessions';
import { countTagUsageForSession } from '@/lib/repositories/tags';
import {
  generateFindingsReport,
  validateFindingsMarkdown,
  type AIProvider,
  type FindingsBlockInput,
} from '@/lib/ai/providers';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import {
  summarizeForBlock,
  type ScaleSummary,
  type NpsSummary,
  type McqSummary,
} from '@/lib/analytics/summaries';
import type { ActionResult } from '@/lib/domain/types';

// ─── Auto-save ───────────────────────────────────────────────────────────────

export async function saveFindingAction(
  findingId: number,
  patch: { title?: string; bodyMarkdown?: string }
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await updateFinding(findingId, userWithTeam.teamId, patch);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de sauvegarder' };
  }
}

// ─── Publish / unpublish ─────────────────────────────────────────────────────

export async function publishFindingAction(
  findingId: number
): Promise<ActionResult<{ token: string; url: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    const data = await publishFinding(findingId, userWithTeam.teamId);
    return { success: true, data };
  } catch {
    return { success: false, error: 'Impossible de publier' };
  }
}

export async function unpublishFindingAction(
  findingId: number
): Promise<ActionResult<void>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  try {
    await unpublishFinding(findingId, userWithTeam.teamId);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de dépublier' };
  }
}

// ─── AI generation ───────────────────────────────────────────────────────────

export async function generateFindingDraftAction(
  sessionId: number,
  providerOverride?: AIProvider
): Promise<ActionResult<{ markdown: string; findingId: number }>> {
  const user = await getUser();
  if (!user) return { success: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { success: false, error: 'Aucune équipe' };

  const session = await getSessionWithBlocks(sessionId, userWithTeam.teamId);
  if (!session) return { success: false, error: 'Session introuvable' };

  // Make sure the finding row exists, get its id
  const finding = await getOrCreateFinding(sessionId, userWithTeam.teamId);
  if (!finding) return { success: false, error: 'Impossible de créer le rapport' };

  // Gather data
  const [responses, tagUsage] = await Promise.all([
    getAllResponsesForSession(sessionId),
    countTagUsageForSession(sessionId),
  ]);

  // Group responses by blockId
  const responsesByBlock = new Map<number, Array<{ id: number; value: unknown }>>();
  for (const r of responses) {
    if (!responsesByBlock.has(r.blockId)) responsesByBlock.set(r.blockId, []);
    responsesByBlock.get(r.blockId)!.push({ id: r.responseId, value: r.value });
  }

  // Build per-block input for the AI
  const orderedBlocks = [...session.blocks]
    .sort((a, b) => a.position - b.position)
    .filter((b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as 'welcome' | 'thank_you'));

  const blocksInput: FindingsBlockInput[] = orderedBlocks.map((block) => {
    const config = (block.config ?? {}) as Record<string, unknown>;
    const question =
      typeof config.question === 'string' && config.question
        ? (config.question as string)
        : block.blockType;
    const blockResponses = responsesByBlock.get(block.id) ?? [];

    const aggregateHint = computeAggregateHint(block.blockType, config, blockResponses.map((r) => r.value));

    return {
      id: block.id,
      blockType: block.blockType,
      question,
      aggregateHint,
      responses: blockResponses.map((r) => ({
        id: r.id,
        blockId: block.id,
        text: stringifyResponseForAI(block.blockType, r.value),
      })),
    };
  });

  // Tag distribution per block as a string hint
  const tagsByBlock: Record<number, string> = {};
  for (const [blockId, tagsMap] of tagUsage.entries()) {
    const items = Array.from(tagsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((t) => `${t.tag.label} (${t.count})`);
    if (items.length > 0) tagsByBlock[blockId] = items.join(', ');
  }

  // Count distinct participantSessions
  const distinctParticipants = new Set(
    responses.map((r) => r.participantSessionId)
  ).size;

  let markdown: string;
  try {
    markdown = await generateFindingsReport({
      sessionTitle: session.title,
      participantCount: distinctParticipants,
      blocks: blocksInput,
      tagsByBlock,
      provider: providerOverride,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erreur IA',
    };
  }

  // Validate citation IDs against the session's actual response set
  const validIds = new Set(responses.map((r) => r.responseId));
  const cleaned = validateFindingsMarkdown(markdown, validIds);

  // Save as the finding's body
  await updateFinding(finding.id, userWithTeam.teamId, {
    bodyMarkdown: cleaned,
    aiGenerated: true,
  });

  return { success: true, data: { markdown: cleaned, findingId: finding.id } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stringifyResponseForAI(blockType: string, value: unknown): string {
  if (value == null) return '';
  switch (blockType) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : '';
    case 'mcq':
      return Array.isArray(value) ? (value as string[]).join(', ') : '';
    case 'matrix':
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value as Record<string, string>)
          .map(([row, col]) => `${row}: ${col}`)
          .join(' | ');
      }
      return '';
    case 'card_sort':
      if (Array.isArray(value)) {
        return (value as Array<{ label?: string }>)
          .map((i) => i.label ?? '')
          .filter(Boolean)
          .join(' > ');
      }
      return '';
    case 'likert':
    case 'rating':
    case 'nps':
      return typeof value === 'number' ? `Note ${value}` : '';
    case 'prototype_task': {
      const r = value as { skipped?: boolean; goalReached?: boolean; manualCompletion?: boolean; completed?: boolean };
      if (r.skipped) return 'tâche abandonnée';
      if (r.goalReached) return 'objectif atteint';
      if (r.manualCompletion) return 'terminée manuellement';
      if (r.completed) return 'complétée';
      return '';
    }
    default:
      return '';
  }
}

function computeAggregateHint(
  blockType: string,
  config: Record<string, unknown>,
  values: unknown[]
): string | undefined {
  const summary = summarizeForBlock(blockType, config, values);
  if (!summary || summary.count === 0) return undefined;

  switch (summary.kind) {
    case 'scale': {
      const s = summary as ScaleSummary;
      return `Moyenne ${s.average?.toFixed(2) ?? '—'} / ${s.max} (médiane ${s.median ?? '—'}, n=${s.count})`;
    }
    case 'nps': {
      const s = summary as NpsSummary;
      return `Score NPS ${s.score ?? '—'} (promoteurs ${s.promoters}, passifs ${s.passives}, détracteurs ${s.detractors})`;
    }
    case 'mcq': {
      const s = summary as McqSummary;
      const top = s.ranked.slice(0, 3).map((r) => `${r.option} (${r.count})`).join(', ');
      return `Top options : ${top}`;
    }
    default:
      return undefined;
  }
}

// ─── Path revalidation helper ────────────────────────────────────────────────

export async function revalidateFindingPath(
  projectId: number,
  sessionId: number
): Promise<void> {
  revalidatePath(`/dashboard/projects/${projectId}/sessions/${sessionId}/findings`);
}
