import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  sessions,
  sessionPages,
  sessionBlocks,
  Session,
  SessionPage,
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

  // 4. Create default short_text block on the question page
  await db.insert(sessionBlocks).values({
    sessionPageId: questionPage.id,
    position: 1,
    blockType: 'short_text',
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

/**
 * Adds a new empty question page to a session, inserted after `afterPageId`.
 * Intro and end page positions are preserved; intermediate pages are renumbered.
 * Returns the full updated pages list (without blocks — caller can merge).
 */
export async function addPage(
  sessionId: number,
  teamId: number,
  afterPageId: number
): Promise<SessionPage[]> {
  // Verify session belongs to team
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!session) throw new Error('Session not found');

  // Load current pages sorted by position
  const currentPages = await db
    .select()
    .from(sessionPages)
    .where(eq(sessionPages.sessionId, sessionId))
    .orderBy(asc(sessionPages.position));

  const afterIdx = currentPages.findIndex((p) => p.id === afterPageId);
  const insertIdx = afterIdx === -1 ? currentPages.length - 1 : afterIdx + 1;

  // Never insert after the end page (always keep end last)
  const endIdx = currentPages.findIndex((p) => p.pageType === 'end');
  const safeInsertIdx = endIdx !== -1 ? Math.min(insertIdx, endIdx) : insertIdx;

  // Build new ordered list with a placeholder for the new page
  const newPageTitle = `Page ${currentPages.filter((p) => p.pageType === 'question').length + 1}`;
  const [newPage] = await db
    .insert(sessionPages)
    .values({
      sessionId,
      position: 9999, // temporary; renumbered below
      title: newPageTitle,
      pageType: 'question',
    })
    .returning();

  // Splice the new page into the ordered list at the safe position
  const reordered = [
    ...currentPages.slice(0, safeInsertIdx),
    newPage,
    ...currentPages.slice(safeInsertIdx),
  ];

  // Renumber all pages 1…n
  await Promise.all(
    reordered.map((page, idx) =>
      db
        .update(sessionPages)
        .set({ position: idx + 1, updatedAt: new Date() })
        .where(eq(sessionPages.id, page.id))
    )
  );

  // Return final sorted pages
  return db
    .select()
    .from(sessionPages)
    .where(eq(sessionPages.sessionId, sessionId))
    .orderBy(asc(sessionPages.position));
}

/**
 * Reorders pages to match `orderedPageIds`.
 * Intro and end pages must remain at first and last positions.
 * Positions are renumbered 1…n based on the provided order.
 */
export async function reorderPages(
  sessionId: number,
  teamId: number,
  orderedPageIds: number[]
): Promise<void> {
  // Verify session belongs to team
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!session) throw new Error('Session not found');

  // Update each page's position according to its index in orderedPageIds
  await Promise.all(
    orderedPageIds.map((pageId, idx) =>
      db
        .update(sessionPages)
        .set({ position: idx + 1, updatedAt: new Date() })
        .where(and(eq(sessionPages.id, pageId), eq(sessionPages.sessionId, sessionId)))
    )
  );
}
