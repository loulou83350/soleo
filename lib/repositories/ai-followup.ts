import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  aiFollowupTurns,
  type AIFollowupTurn,
  type NewAIFollowupTurn,
} from '@/lib/db/schema';

export type TurnStatus = 'answered' | 'skipped' | 'timeout' | 'error';

export async function insertTurn(
  params: NewAIFollowupTurn
): Promise<AIFollowupTurn> {
  const [row] = await db.insert(aiFollowupTurns).values(params).returning();
  return row;
}

export async function updateTurnAnswer(
  turnId: number,
  participantSessionId: number,
  answer: string | null,
  status: TurnStatus
): Promise<AIFollowupTurn | null> {
  const [row] = await db
    .update(aiFollowupTurns)
    .set({ participantAnswer: answer, status })
    .where(
      and(
        eq(aiFollowupTurns.id, turnId),
        eq(aiFollowupTurns.participantSessionId, participantSessionId)
      )
    )
    .returning();
  return row ?? null;
}

/** All turns for one parent block_response, oldest first (turn 1 → N). */
export async function getTurnsForResponse(
  parentResponseId: number
): Promise<AIFollowupTurn[]> {
  return db
    .select()
    .from(aiFollowupTurns)
    .where(eq(aiFollowupTurns.parentResponseId, parentResponseId))
    .orderBy(asc(aiFollowupTurns.turnNumber));
}

/** Batch version for the dashboard list — returns a Map keyed by parentResponseId. */
export async function getTurnsForResponses(
  parentResponseIds: number[]
): Promise<Map<number, AIFollowupTurn[]>> {
  if (parentResponseIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(aiFollowupTurns)
    .where(inArray(aiFollowupTurns.parentResponseId, parentResponseIds))
    .orderBy(asc(aiFollowupTurns.turnNumber));
  const out = new Map<number, AIFollowupTurn[]>();
  for (const r of rows) {
    if (!out.has(r.parentResponseId)) out.set(r.parentResponseId, []);
    out.get(r.parentResponseId)!.push(r);
  }
  return out;
}
