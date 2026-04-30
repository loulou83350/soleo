import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { sessions, sessionBlocks, SessionBlock } from '@/lib/db/schema';
import type { BlockType, BlockConfig } from '@/lib/db/schema';
import type { BlockVisibilityRule } from '@/lib/domain/types';
import { BLOCK_DEFAULTS, ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';

// ─── Internal: team-scoped block lookup ──────────────────────────────────────

/**
 * Returns the block + its session's teamId for authorization checks.
 * Joins: session_blocks → sessions (flat model — no pages).
 */
async function getBlockWithSession(blockId: number) {
  const [row] = await db
    .select({
      block: sessionBlocks,
      teamId: sessions.teamId,
      sessionId: sessionBlocks.sessionId,
    })
    .from(sessionBlocks)
    .innerJoin(sessions, eq(sessions.id, sessionBlocks.sessionId))
    .where(eq(sessionBlocks.id, blockId))
    .limit(1);
  return row ?? null;
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Adds a new block to a session after `afterBlockId`.
 * The new block is inserted at position afterBlock.position + 1;
 * all subsequent blocks are shifted up by 1.
 * welcome and thank_you types cannot be inserted via this function.
 */
export async function addBlock(
  sessionId: number,
  teamId: number,
  afterBlockId: number,
  blockType: BlockType
): Promise<SessionBlock> {
  // Guard: cannot add anchor block types through palette
  if (ANCHOR_BLOCK_TYPES.includes(blockType)) {
    throw new Error('Ce type de bloc ne peut pas être ajouté manuellement');
  }

  // Verify session belongs to team
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!session) throw new Error('Session introuvable');

  // Get the afterBlock's position
  const [afterBlock] = await db
    .select()
    .from(sessionBlocks)
    .where(and(eq(sessionBlocks.id, afterBlockId), eq(sessionBlocks.sessionId, sessionId)))
    .limit(1);
  if (!afterBlock) throw new Error('Bloc de référence introuvable');

  // Never insert after the thank_you block (always last)
  // If afterBlock is thank_you, insert before it instead
  const afterPos = afterBlock.blockType === 'thank_you'
    ? afterBlock.position - 1
    : afterBlock.position;
  const insertPos = afterPos + 1;

  // Shift all blocks at insertPos or later up by 1
  await db
    .update(sessionBlocks)
    .set({ position: sql`position + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(sessionBlocks.sessionId, sessionId),
        sql`${sessionBlocks.position} >= ${insertPos}`
      )
    );

  // Insert new block at insertPos
  const [block] = await db
    .insert(sessionBlocks)
    .values({
      sessionId,
      position: insertPos,
      blockType,
      config: BLOCK_DEFAULTS[blockType],
      required: false,
    })
    .returning();

  return block;
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Updates a block's config and/or required flag, scoped by teamId.
 */
export async function updateBlock(
  blockId: number,
  teamId: number,
  updates: { config?: BlockConfig; required?: boolean; conditions?: BlockVisibilityRule }
): Promise<void> {
  const row = await getBlockWithSession(blockId);
  if (!row || row.teamId !== teamId) throw new Error('Bloc introuvable');

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.config !== undefined) setValues.config = updates.config;
  if (updates.required !== undefined) setValues.required = updates.required;
  if ('conditions' in updates) setValues.conditions = updates.conditions ?? null;

  await db
    .update(sessionBlocks)
    .set(setValues)
    .where(eq(sessionBlocks.id, blockId));
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/**
 * Deletes a block, scoped by teamId.
 * welcome and thank_you blocks cannot be deleted.
 */
export async function deleteBlock(blockId: number, teamId: number): Promise<void> {
  const row = await getBlockWithSession(blockId);
  if (!row || row.teamId !== teamId) throw new Error('Bloc introuvable');
  if (ANCHOR_BLOCK_TYPES.includes(row.block.blockType as BlockType)) {
    throw new Error('Ce bloc ne peut pas être supprimé');
  }

  await db.delete(sessionBlocks).where(eq(sessionBlocks.id, blockId));
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

/**
 * Reorders blocks within a session to match orderedBlockIds.
 * Positions are renumbered 1…n.
 * welcome must stay first, thank_you must stay last — caller is responsible.
 */
export async function reorderSessionBlocks(
  sessionId: number,
  teamId: number,
  orderedBlockIds: number[]
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!session) throw new Error('Session introuvable');

  await Promise.all(
    orderedBlockIds.map((blockId, idx) =>
      db
        .update(sessionBlocks)
        .set({ position: idx + 1, updatedAt: new Date() })
        .where(and(eq(sessionBlocks.id, blockId), eq(sessionBlocks.sessionId, sessionId)))
    )
  );
}

/**
 * Returns all blocks for a session ordered by position.
 * Used internally by other repositories.
 */
export async function getBlocksBySession(sessionId: number): Promise<SessionBlock[]> {
  return db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.position));
}
