import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { participantSessions, blockResponses } from '@/lib/db/schema';
import type { ParticipantSession, BlockResponse } from '@/lib/db/schema';

// ─── Start / Resume ──────────────────────────────────────────────────────────

/**
 * Creates a new participant session for a given session.
 * Returns the row including the generated participantToken.
 */
export async function startParticipantSession(
  sessionId: number
): Promise<ParticipantSession> {
  const participantToken = crypto.randomUUID().replace(/-/g, '');

  const [row] = await db
    .insert(participantSessions)
    .values({ sessionId, participantToken })
    .returning();

  return row;
}

/**
 * Looks up a participant session by its token.
 * Returns null if not found.
 */
export async function getParticipantSession(
  participantToken: string
): Promise<ParticipantSession | null> {
  const [row] = await db
    .select()
    .from(participantSessions)
    .where(eq(participantSessions.participantToken, participantToken))
    .limit(1);

  return row ?? null;
}

// ─── Complete ────────────────────────────────────────────────────────────────

/**
 * Marks a participant session as completed.
 */
export async function completeParticipantSession(
  participantSessionId: number
): Promise<void> {
  await db
    .update(participantSessions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(participantSessions.id, participantSessionId));
}

// ─── Response upsert ─────────────────────────────────────────────────────────

/**
 * Upserts a block response for a participant session.
 * Uses ON CONFLICT (participant_session_id, block_id) DO UPDATE.
 */
export async function upsertBlockResponse(
  participantSessionId: number,
  blockId: number,
  value: unknown
): Promise<BlockResponse> {
  const [row] = await db
    .insert(blockResponses)
    .values({ participantSessionId, blockId, value: value as Record<string, unknown> })
    .onConflictDoUpdate({
      target: [blockResponses.participantSessionId, blockResponses.blockId],
      set: { value: value as Record<string, unknown>, answeredAt: new Date() },
    })
    .returning();

  return row;
}

/**
 * Returns all block responses for a given participant session.
 */
export async function getBlockResponses(
  participantSessionId: number
): Promise<BlockResponse[]> {
  return db
    .select()
    .from(blockResponses)
    .where(eq(blockResponses.participantSessionId, participantSessionId));
}

// ─── Counts (Story 4.5) ──────────────────────────────────────────────────────

/**
 * Returns the number of completed participant sessions for a given session.
 * Used in completion emails to show "Nth participant has completed".
 */
export async function countCompletedParticipants(sessionId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participantSessions)
    .where(
      and(
        eq(participantSessions.sessionId, sessionId),
        eq(participantSessions.status, 'completed')
      )
    );
  return row?.count ?? 0;
}
