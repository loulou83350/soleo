import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  sessions,
  sessionPages,
  sessionBlocks,
  Session,
  SessionWithPages,
} from '@/lib/db/schema';

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Creates a new session in draft state with default pages:
 *   1. Intro page (type='intro')
 *   2. Question page (type='question') + one empty open_text block
 *   3. End page (type='end')
 * All scoped to teamId (workspace isolation).
 */
export async function createSession(
  teamId: number,
  projectId: number
): Promise<Session> {
  // 1. Create the session
  const [session] = await db
    .insert(sessions)
    .values({ teamId, projectId, title: 'Nouvelle session', status: 'draft' })
    .returning();

  // 2. Create intro page
  await db.insert(sessionPages).values({
    sessionId: session.id,
    position: 1,
    title: 'Introduction',
    pageType: 'intro',
  });

  // 3. Create question page
  const [questionPage] = await db
    .insert(sessionPages)
    .values({
      sessionId: session.id,
      position: 2,
      title: 'Page 1',
      pageType: 'question',
    })
    .returning();

  // 4. Create default open_text block on the question page
  await db.insert(sessionBlocks).values({
    sessionPageId: questionPage.id,
    position: 1,
    blockType: 'open_text',
    config: { question: '', placeholder: '' },
    required: false,
  });

  // 5. Create end page
  await db.insert(sessionPages).values({
    sessionId: session.id,
    position: 3,
    title: 'Fin',
    pageType: 'end',
  });

  return session;
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Returns all sessions for a project, scoped by teamId.
 * Ordered newest-first.
 */
export async function getSessionsByProject(
  projectId: number,
  teamId: number
): Promise<Session[]> {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.projectId, projectId), eq(sessions.teamId, teamId)))
    .orderBy(desc(sessions.createdAt));
}

/**
 * Returns a session with all its pages and blocks, scoped by teamId.
 * Pages ordered by position; blocks ordered by position within each page.
 */
export async function getSessionWithPages(
  sessionId: number,
  teamId: number
): Promise<SessionWithPages | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);

  if (!session) return null;

  const pages = await db
    .select()
    .from(sessionPages)
    .where(eq(sessionPages.sessionId, sessionId))
    .orderBy(asc(sessionPages.position));

  const pageIds = pages.map((p) => p.id);
  const blocks =
    pageIds.length > 0
      ? await db
          .select()
          .from(sessionBlocks)
          .where(inArray(sessionBlocks.sessionPageId, pageIds))
          .orderBy(asc(sessionBlocks.position))
      : [];

  // Group blocks by page
  const blocksByPage = new Map<number, typeof blocks>();
  for (const block of blocks) {
    const list = blocksByPage.get(block.sessionPageId) ?? [];
    list.push(block);
    blocksByPage.set(block.sessionPageId, list);
  }

  return {
    ...session,
    pages: pages.map((page) => ({
      ...page,
      blocks: blocksByPage.get(page.id) ?? [],
    })),
  };
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Updates the title of a session, scoped by teamId.
 */
export async function updateSessionTitle(
  sessionId: number,
  teamId: number,
  title: string
): Promise<void> {
  await db
    .update(sessions)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)));
}
