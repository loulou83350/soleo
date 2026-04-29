import { eq, and, max } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { sessions, sessionPages, sessionBlocks, SessionBlock } from '@/lib/db/schema';
import type { BlockType, BlockConfig } from '@/lib/db/schema';
import type { BlockVisibilityRule } from '@/lib/domain/types';
import { BLOCK_DEFAULTS } from '@/lib/domain/blocks';

// ─── Internal: team-scoped block lookup ──────────────────────────────────────

/**
 * Returns the block + its session's teamId for authorization checks.
 * Joins: session_blocks → session_pages → sessions
 */
async function getBlockWithSession(blockId: number) {
  const [row] = await db
    .select({
      block: sessionBlocks,
      teamId: sessions.teamId,
      sessionPageId: sessionBlocks.sessionPageId,
    })
    .from(sessionBlocks)
    .innerJoin(sessionPages, eq(sessionPages.id, sessionBlocks.sessionPageId))
    .innerJoin(sessions, eq(sessions.id, sessionPages.sessionId))
    .where(eq(sessionBlocks.id, blockId))
    .limit(1);
  return row ?? null;
}

/**
 * Returns the session's teamId for a given page.
 */
async function getPageTeamId(sessionPageId: number): Promise<number | null> {
  const [row] = await db
    .select({ teamId: sessions.teamId })
    .from(sessionPages)
    .innerJoin(sessions, eq(sessions.id, sessionPages.sessionId))
    .where(eq(sessionPages.id, sessionPageId))
    .limit(1);
  return row?.teamId ?? null;
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Adds a new block of the given type to a page.
 * Position = current max + 1.
 * Config is pre-populated with sensible defaults.
 */
export async function addBlock(
  sessionPageId: number,
  teamId: number,
  blockType: BlockType
): Promise<SessionBlock> {
  // Verify page belongs to team
  const pageTeamId = await getPageTeamId(sessionPageId);
  if (pageTeamId !== teamId) throw new Error('Page introuvable');

  // Compute next position
  const maxResult = await db
    .select({ maxPos: max(sessionBlocks.position) })
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionPageId, sessionPageId))
    .limit(1);

  const position = (maxResult[0]?.maxPos ?? 0) + 1;

  const [block] = await db
    .insert(sessionBlocks)
    .values({
      sessionPageId,
      position,
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
 */
export async function deleteBlock(blockId: number, teamId: number): Promise<void> {
  const row = await getBlockWithSession(blockId);
  if (!row || row.teamId !== teamId) throw new Error('Bloc introuvable');

  await db.delete(sessionBlocks).where(eq(sessionBlocks.id, blockId));
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

/**
 * Reorders blocks within a page to match orderedBlockIds.
 * Positions are renumbered 1…n.
 */
export async function reorderBlocks(
  sessionPageId: number,
  teamId: number,
  orderedBlockIds: number[]
): Promise<void> {
  const pageTeamId = await getPageTeamId(sessionPageId);
  if (pageTeamId !== teamId) throw new Error('Page introuvable');

  await Promise.all(
    orderedBlockIds.map((blockId, idx) =>
      db
        .update(sessionBlocks)
        .set({ position: idx + 1, updatedAt: new Date() })
        .where(
          and(
            eq(sessionBlocks.id, blockId),
            eq(sessionBlocks.sessionPageId, sessionPageId)
          )
        )
    )
  );
}
