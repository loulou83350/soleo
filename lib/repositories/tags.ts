import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  insightTags,
  blockResponseTags,
  blockResponses,
  participantSessions,
  sessions,
  type InsightTag,
  type TagSource,
} from '@/lib/db/schema';

// ─── Tag library (team-scoped) ───────────────────────────────────────────────

export async function listTeamTags(teamId: number): Promise<InsightTag[]> {
  return db
    .select()
    .from(insightTags)
    .where(eq(insightTags.teamId, teamId))
    .orderBy(insightTags.label);
}

export async function createTag({
  teamId,
  userId,
  label,
  color,
}: {
  teamId: number;
  userId: number;
  label: string;
  color: string;
}): Promise<InsightTag> {
  // Reuse existing tag with the same label (case-insensitive) — avoids dupes
  const existing = await db
    .select()
    .from(insightTags)
    .where(
      and(
        eq(insightTags.teamId, teamId),
        sql`lower(${insightTags.label}) = lower(${label})`
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [row] = await db
    .insert(insightTags)
    .values({ teamId, createdBy: userId, label: label.trim(), color })
    .returning();
  return row;
}

export async function deleteTag(tagId: number, teamId: number): Promise<void> {
  await db
    .delete(insightTags)
    .where(and(eq(insightTags.id, tagId), eq(insightTags.teamId, teamId)));
}

// ─── Tag <-> Response (team-isolated via JOIN check) ─────────────────────────

/**
 * Verifies that a response belongs to a session of the given team.
 * Used by attach/detach to enforce team isolation.
 */
async function assertResponseInTeam(
  responseId: number,
  teamId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: blockResponses.id })
    .from(blockResponses)
    .innerJoin(
      participantSessions,
      eq(blockResponses.participantSessionId, participantSessions.id)
    )
    .innerJoin(sessions, eq(participantSessions.sessionId, sessions.id))
    .where(
      and(eq(blockResponses.id, responseId), eq(sessions.teamId, teamId))
    )
    .limit(1);
  return !!row;
}

export async function attachTag({
  responseId,
  tagId,
  source,
  teamId,
}: {
  responseId: number;
  tagId: number;
  source: TagSource;
  teamId: number;
}): Promise<void> {
  if (!(await assertResponseInTeam(responseId, teamId))) {
    throw new Error('Response not in team');
  }
  // Verify tag belongs to team too
  const [tag] = await db
    .select({ id: insightTags.id })
    .from(insightTags)
    .where(and(eq(insightTags.id, tagId), eq(insightTags.teamId, teamId)))
    .limit(1);
  if (!tag) throw new Error('Tag not in team');

  await db
    .insert(blockResponseTags)
    .values({ responseId, tagId, source })
    .onConflictDoNothing(); // unique(responseId, tagId)
}

export async function detachTag({
  responseId,
  tagId,
  teamId,
}: {
  responseId: number;
  tagId: number;
  teamId: number;
}): Promise<void> {
  if (!(await assertResponseInTeam(responseId, teamId))) {
    throw new Error('Response not in team');
  }
  await db
    .delete(blockResponseTags)
    .where(
      and(
        eq(blockResponseTags.responseId, responseId),
        eq(blockResponseTags.tagId, tagId)
      )
    );
}

// ─── Read helpers ────────────────────────────────────────────────────────────

export interface TagAttachment {
  tagId: number;
  source: TagSource;
  tag: InsightTag;
}

/**
 * For a list of response IDs, returns a map response_id → array of tag attachments.
 * Single query with JOIN.
 */
export async function listTagsForResponses(
  responseIds: number[]
): Promise<Map<number, TagAttachment[]>> {
  if (responseIds.length === 0) return new Map();

  const rows = await db
    .select({
      responseId: blockResponseTags.responseId,
      tagId: blockResponseTags.tagId,
      source: blockResponseTags.source,
      tag: insightTags,
    })
    .from(blockResponseTags)
    .innerJoin(insightTags, eq(blockResponseTags.tagId, insightTags.id))
    .where(inArray(blockResponseTags.responseId, responseIds));

  const out = new Map<number, TagAttachment[]>();
  for (const r of rows) {
    if (!out.has(r.responseId)) out.set(r.responseId, []);
    out.get(r.responseId)!.push({
      tagId: r.tagId,
      source: r.source as TagSource,
      tag: r.tag,
    });
  }
  return out;
}

/**
 * For a session, returns per-block tag usage counts.
 * Used by the summary view to show "X responses tagged Y" per block.
 */
export async function countTagUsageForSession(
  sessionId: number
): Promise<Map<number, Map<number, { tag: InsightTag; count: number }>>> {
  const rows = await db
    .select({
      blockId: blockResponses.blockId,
      tagId: blockResponseTags.tagId,
      count: sql<number>`count(*)::int`,
      tag: insightTags,
    })
    .from(blockResponseTags)
    .innerJoin(blockResponses, eq(blockResponseTags.responseId, blockResponses.id))
    .innerJoin(
      participantSessions,
      eq(blockResponses.participantSessionId, participantSessions.id)
    )
    .innerJoin(insightTags, eq(blockResponseTags.tagId, insightTags.id))
    .where(eq(participantSessions.sessionId, sessionId))
    .groupBy(blockResponses.blockId, blockResponseTags.tagId, insightTags.id);

  const out = new Map<number, Map<number, { tag: InsightTag; count: number }>>();
  for (const r of rows) {
    if (!out.has(r.blockId)) out.set(r.blockId, new Map());
    out.get(r.blockId)!.set(r.tagId, { tag: r.tag, count: r.count });
  }
  return out;
}

/**
 * Returns the IDs of participant_sessions whose responses include at least one
 * of the given tag IDs, in the given session. Used by the dashboard tag filter.
 */
export async function listParticipantSessionsWithTags(
  sessionId: number,
  tagIds: number[]
): Promise<number[]> {
  if (tagIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: participantSessions.id })
    .from(participantSessions)
    .innerJoin(blockResponses, eq(blockResponses.participantSessionId, participantSessions.id))
    .innerJoin(blockResponseTags, eq(blockResponseTags.responseId, blockResponses.id))
    .where(
      and(
        eq(participantSessions.sessionId, sessionId),
        inArray(blockResponseTags.tagId, tagIds)
      )
    );
  return rows.map((r) => r.id);
}

/**
 * Lookup or create a tag by case-insensitive label. Used by AI auto-tagging
 * when the model proposes a label that may or may not exist.
 */
export async function findOrCreateTagByLabel({
  teamId,
  userId,
  label,
  color,
}: {
  teamId: number;
  userId: number | null;
  label: string;
  color: string;
}): Promise<InsightTag> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Empty tag label');

  const existing = await db
    .select()
    .from(insightTags)
    .where(
      and(
        eq(insightTags.teamId, teamId),
        sql`lower(${insightTags.label}) = lower(${trimmed})`
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [row] = await db
    .insert(insightTags)
    .values({ teamId, createdBy: userId, label: trimmed, color })
    .returning();
  return row;
}
