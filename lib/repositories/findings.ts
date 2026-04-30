import { eq, and, asc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db/drizzle';
import {
  sessionFindings,
  findingHighlights,
  blockResponses,
  participantSessions,
  sessionBlocks,
  sessions,
  type SessionFinding,
  type FindingHighlight,
} from '@/lib/db/schema';

// ─── Team isolation helper ───────────────────────────────────────────────────

async function assertSessionInTeam(
  sessionId: number,
  teamId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  return !!row;
}

async function assertFindingInTeam(
  findingId: number,
  teamId: number
): Promise<{ sessionId: number } | null> {
  const [row] = await db
    .select({ id: sessionFindings.id, sessionId: sessionFindings.sessionId })
    .from(sessionFindings)
    .innerJoin(sessions, eq(sessionFindings.sessionId, sessions.id))
    .where(
      and(eq(sessionFindings.id, findingId), eq(sessions.teamId, teamId))
    )
    .limit(1);
  return row ? { sessionId: row.sessionId } : null;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getFindingForSession(
  sessionId: number,
  teamId: number
): Promise<SessionFinding | null> {
  if (!(await assertSessionInTeam(sessionId, teamId))) return null;
  const [row] = await db
    .select()
    .from(sessionFindings)
    .where(eq(sessionFindings.sessionId, sessionId))
    .limit(1);
  return row ?? null;
}

/**
 * Lazy create: if no finding exists yet for this session, creates an empty
 * one. Used as the entry point of the editor route.
 */
export async function getOrCreateFinding(
  sessionId: number,
  teamId: number
): Promise<SessionFinding | null> {
  if (!(await assertSessionInTeam(sessionId, teamId))) return null;
  const existing = await getFindingForSession(sessionId, teamId);
  if (existing) return existing;
  const [created] = await db
    .insert(sessionFindings)
    .values({ sessionId, title: '', bodyMarkdown: '' })
    .returning();
  return created;
}

/**
 * Public read for the /findings/[token] route. No team check — the token
 * itself acts as the access credential. Returns null if not found OR if
 * the finding is unpublished.
 */
export async function getPublishedFindingByToken(
  token: string
): Promise<SessionFinding | null> {
  const [row] = await db
    .select()
    .from(sessionFindings)
    .where(
      and(
        eq(sessionFindings.publicToken, token),
        eq(sessionFindings.isPublished, true)
      )
    )
    .limit(1);
  return row ?? null;
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function updateFinding(
  findingId: number,
  teamId: number,
  patch: Partial<Pick<SessionFinding, 'title' | 'bodyMarkdown' | 'aiGenerated'>>
): Promise<void> {
  if (!(await assertFindingInTeam(findingId, teamId))) {
    throw new Error('Finding not in team');
  }
  await db
    .update(sessionFindings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sessionFindings.id, findingId));
}

export async function publishFinding(
  findingId: number,
  teamId: number
): Promise<{ token: string; url: string }> {
  if (!(await assertFindingInTeam(findingId, teamId))) {
    throw new Error('Finding not in team');
  }
  // Reuse existing token if any (so the URL is stable across publish/unpublish)
  const [existing] = await db
    .select({ publicToken: sessionFindings.publicToken })
    .from(sessionFindings)
    .where(eq(sessionFindings.id, findingId))
    .limit(1);

  const token = existing?.publicToken ?? createId();
  await db
    .update(sessionFindings)
    .set({
      isPublished: true,
      publicToken: token,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessionFindings.id, findingId));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return { token, url: `${baseUrl}/findings/${token}` };
}

export async function unpublishFinding(
  findingId: number,
  teamId: number
): Promise<void> {
  if (!(await assertFindingInTeam(findingId, teamId))) {
    throw new Error('Finding not in team');
  }
  await db
    .update(sessionFindings)
    .set({ isPublished: false, updatedAt: new Date() })
    .where(eq(sessionFindings.id, findingId));
}

// ─── Highlights (Story 6.2) ──────────────────────────────────────────────────

/**
 * Verifies that a response belongs to a session of the given team and that
 * the finding (auto-created if missing) is also in that team. Returns the
 * findingId. Throws on team mismatch.
 */
async function resolveFindingForResponse(
  responseId: number,
  teamId: number
): Promise<number> {
  // response → participantSession → session → teamId
  const [row] = await db
    .select({ sessionId: sessions.id })
    .from(blockResponses)
    .innerJoin(
      participantSessions,
      eq(blockResponses.participantSessionId, participantSessions.id)
    )
    .innerJoin(sessions, eq(participantSessions.sessionId, sessions.id))
    .where(
      and(
        eq(blockResponses.id, responseId),
        eq(sessions.teamId, teamId)
      )
    )
    .limit(1);
  if (!row) throw new Error('Response not in team');

  // Get or create the finding for this session
  const existing = await db
    .select({ id: sessionFindings.id })
    .from(sessionFindings)
    .where(eq(sessionFindings.sessionId, row.sessionId))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const [created] = await db
    .insert(sessionFindings)
    .values({ sessionId: row.sessionId, title: '', bodyMarkdown: '' })
    .returning({ id: sessionFindings.id });
  return created.id;
}

export async function pinHighlight({
  responseId,
  teamId,
  customNote,
}: {
  responseId: number;
  teamId: number;
  customNote?: string;
}): Promise<FindingHighlight> {
  const findingId = await resolveFindingForResponse(responseId, teamId);

  // Check if it already exists (toggle / no-op)
  const [existing] = await db
    .select()
    .from(findingHighlights)
    .where(
      and(
        eq(findingHighlights.findingId, findingId),
        eq(findingHighlights.responseId, responseId)
      )
    )
    .limit(1);
  if (existing) return existing;

  // Compute next position
  const [maxRow] = await db
    .select({ maxPos: sql<number>`coalesce(max(${findingHighlights.position}), 0)::int` })
    .from(findingHighlights)
    .where(eq(findingHighlights.findingId, findingId));
  const nextPos = (maxRow?.maxPos ?? 0) + 10;

  const [row] = await db
    .insert(findingHighlights)
    .values({ findingId, responseId, customNote: customNote ?? null, position: nextPos })
    .returning();
  return row;
}

export async function unpinHighlight({
  responseId,
  teamId,
}: {
  responseId: number;
  teamId: number;
}): Promise<void> {
  const findingId = await resolveFindingForResponse(responseId, teamId);
  await db
    .delete(findingHighlights)
    .where(
      and(
        eq(findingHighlights.findingId, findingId),
        eq(findingHighlights.responseId, responseId)
      )
    );
}

export interface HighlightWithSource {
  highlight: FindingHighlight;
  responseId: number;
  blockId: number;
  blockType: string;
  question: string;
  value: unknown;
  participantSessionId: number;
}

/**
 * List all highlights for a finding, with the joined response + block context.
 * Used by both the editor (for the pinned-quotes panel) and the public viewer.
 */
export async function listHighlightsForFinding(
  findingId: number
): Promise<HighlightWithSource[]> {
  const rows = await db
    .select({
      highlight: findingHighlights,
      responseId: blockResponses.id,
      blockId: blockResponses.blockId,
      value: blockResponses.value,
      participantSessionId: blockResponses.participantSessionId,
      blockType: sessionBlocks.blockType,
      blockConfig: sessionBlocks.config,
    })
    .from(findingHighlights)
    .innerJoin(blockResponses, eq(findingHighlights.responseId, blockResponses.id))
    .innerJoin(sessionBlocks, eq(blockResponses.blockId, sessionBlocks.id))
    .where(eq(findingHighlights.findingId, findingId))
    .orderBy(asc(findingHighlights.position));

  return rows.map((r) => {
    const cfg = (r.blockConfig ?? {}) as Record<string, unknown>;
    const question =
      typeof cfg.question === 'string' && cfg.question
        ? (cfg.question as string)
        : r.blockType;
    return {
      highlight: r.highlight,
      responseId: r.responseId,
      blockId: r.blockId,
      blockType: r.blockType,
      question,
      value: r.value,
      participantSessionId: r.participantSessionId,
    };
  });
}

/**
 * Returns the IDs of responses pinned for a session's finding. Used by the
 * participant detail page to show the current pinned state of each response.
 */
export async function listPinnedResponseIdsForSession(
  sessionId: number
): Promise<Set<number>> {
  const rows = await db
    .select({ responseId: findingHighlights.responseId })
    .from(findingHighlights)
    .innerJoin(sessionFindings, eq(findingHighlights.findingId, sessionFindings.id))
    .where(eq(sessionFindings.sessionId, sessionId));
  return new Set(rows.map((r) => r.responseId));
}

/**
 * Reorder highlights. `orderedIds` is the list of highlight IDs (not response
 * IDs) in the desired order. Each row's position is set to its index * 10.
 */
export async function reorderHighlights({
  findingId,
  teamId,
  orderedIds,
}: {
  findingId: number;
  teamId: number;
  orderedIds: number[];
}): Promise<void> {
  // Team check via finding → session → teamId
  const [check] = await db
    .select({ id: sessionFindings.id })
    .from(sessionFindings)
    .innerJoin(sessions, eq(sessionFindings.sessionId, sessions.id))
    .where(and(eq(sessionFindings.id, findingId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!check) throw new Error('Finding not in team');

  // Update each row's position. Small loop is fine (max ~20 highlights).
  await Promise.all(
    orderedIds.map((id, idx) =>
      db
        .update(findingHighlights)
        .set({ position: (idx + 1) * 10 })
        .where(
          and(
            eq(findingHighlights.id, id),
            eq(findingHighlights.findingId, findingId)
          )
        )
    )
  );
}
