import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db/drizzle';
import {
  sessionFindings,
  sessions,
  type SessionFinding,
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
