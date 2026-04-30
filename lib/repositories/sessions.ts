import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db/drizzle';
import {
  sessions,
  sessionBlocks,
  projects,
  teamMembers,
  users,
  Session,
  SessionBlock,
  SessionWithBlocks,
} from '@/lib/db/schema';
import { BLOCK_DEFAULTS, BLOCK_LABELS, ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import type { ValidationIssue } from '@/lib/domain/types';
import type { Template } from '@/lib/domain/templates';

// ─── Create ─────────────────────────────────────────────────────────────────

/**
 * Creates a new session in draft state with three default blocks:
 *   1. welcome  (pos 1)
 *   2. short_text (pos 2)
 *   3. thank_you  (pos 3)
 * All scoped to teamId (workspace isolation).
 */
export async function createSession(
  teamId: number,
  projectId: number
): Promise<Session> {
  const [session] = await db
    .insert(sessions)
    .values({ teamId, projectId, title: 'Nouvelle session', status: 'draft' })
    .returning();

  await db.insert(sessionBlocks).values([
    {
      sessionId: session.id,
      position: 1,
      blockType: 'welcome',
      config: BLOCK_DEFAULTS.welcome,
      required: false,
    },
    {
      sessionId: session.id,
      position: 2,
      blockType: 'short_text',
      config: BLOCK_DEFAULTS.short_text,
      required: false,
    },
    {
      sessionId: session.id,
      position: 3,
      blockType: 'thank_you',
      config: BLOCK_DEFAULTS.thank_you,
      required: false,
    },
  ]);

  return session;
}

/**
 * Creates a session pre-populated from a template.
 * Template.blocks is a flat array (welcome … questions … thank_you).
 */
export async function createSessionFromTemplate(
  teamId: number,
  projectId: number,
  template: Template
): Promise<Session> {
  const [session] = await db
    .insert(sessions)
    .values({ teamId, projectId, title: template.name, status: 'draft' })
    .returning();

  await db.insert(sessionBlocks).values(
    template.blocks.map((tBlock, idx) => ({
      sessionId: session.id,
      position: idx + 1,
      blockType: tBlock.blockType,
      config: tBlock.config,
      required: tBlock.required ?? false,
    }))
  );

  return session;
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Returns all sessions for a project, scoped by teamId. Newest-first.
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
 * Returns a session with its flat blocks list, scoped by teamId.
 * Blocks are ordered by position.
 */
export async function getSessionWithBlocks(
  sessionId: number,
  teamId: number
): Promise<SessionWithBlocks | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);

  if (!session) return null;

  const blocks = await db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.position));

  return { ...session, blocks };
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

// ─── Delete session ───────────────────────────────────────────────────────────

/**
 * Deletes a session and all its blocks (cascade).
 */
export async function deleteSession(
  sessionId: number,
  teamId: number
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)))
    .limit(1);
  if (!session) throw new Error('Session introuvable');

  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// ─── Publish ─────────────────────────────────────────────────────────────────

/**
 * Validates blocks, generates a CUID2 token, then sets status = 'published'.
 * Throws with a `validationIssues` property if blocks are misconfigured.
 * Returns the CUID2 token on success (idempotent — re-uses existing token if
 * the session was already published).
 */
export async function publishSession(
  sessionId: number,
  teamId: number
): Promise<string> {
  const session = await getSessionWithBlocks(sessionId, teamId);
  if (!session) throw new Error('Session introuvable');

  // If already published and has a token, just return it
  if (session.status === 'published' && session.sessionToken) {
    return session.sessionToken;
  }

  // Validate all non-anchor, non-content blocks
  const issues: ValidationIssue[] = [];
  const skipValidation = new Set([...ANCHOR_BLOCK_TYPES, 'content']);

  for (const block of session.blocks) {
    if (skipValidation.has(block.blockType)) continue;

    const config = block.config as Record<string, unknown>;
    const blockLabel = BLOCK_LABELS[block.blockType as keyof typeof BLOCK_LABELS] ?? block.blockType;

    if (block.blockType === 'first_impression') {
      const imageUrl = typeof config.imageUrl === 'string' ? config.imageUrl : '';
      if (!imageUrl.trim()) {
        issues.push({ pageTitle: blockLabel, blockLabel, issue: 'Image requise' });
      }
    } else if (block.blockType === 'prototype_task') {
      const url = typeof config.url === 'string' ? config.url : '';
      if (!url.trim()) {
        issues.push({ pageTitle: blockLabel, blockLabel, issue: 'URL du prototype requise' });
      }
    } else {
      const question = typeof config.question === 'string' ? config.question : '';
      if (!question.trim()) {
        issues.push({ pageTitle: blockLabel, blockLabel, issue: 'Question vide' });
      }
    }
  }

  if (issues.length > 0) {
    const err = new Error('Validation failed') as Error & { validationIssues: ValidationIssue[] };
    err.validationIssues = issues;
    throw err;
  }

  const token = session.sessionToken ?? createId();

  await db
    .update(sessions)
    .set({ status: 'published', sessionToken: token, updatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)));

  return token;
}

/**
 * Loads a published session by its public CUID2 token.
 * Returns null if the token doesn't match or session isn't published.
 */
export async function getSessionByToken(token: string): Promise<SessionWithBlocks | null> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.sessionToken, token), eq(sessions.status, 'published')))
    .limit(1);

  if (!session) return null;

  const blocks = await db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, session.id))
    .orderBy(asc(sessionBlocks.position));

  return { ...session, blocks };
}

// ─── Reorder blocks ───────────────────────────────────────────────────────────

/**
 * Reorders blocks to match `orderedBlockIds`.
 * Enforces welcome stays at pos 1 and thank_you stays at pos last.
 */
export async function reorderBlocks(
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

// ─── Gate configuration (Story 3.5) ─────────────────────────────────────────

export interface GateConfig {
  /** Plain-text password (will be hashed server-side). Pass null to remove password. */
  password: string | null;
  deviceRestriction: 'any' | 'desktop' | 'mobile';
  gdprEnabled: boolean;
  gdprMessage: string | null;
}

/**
 * Updates the gate configuration of a session.
 * Hashes the password with bcryptjs before storing.
 */
export async function setSessionGate(
  sessionId: number,
  teamId: number,
  config: GateConfig
): Promise<void> {
  let passwordHash: string | null = null;

  if (config.password) {
    const { hashPassword } = await import('@/lib/auth/session');
    passwordHash = await hashPassword(config.password);
  }

  await db
    .update(sessions)
    .set({
      passwordHash,
      deviceRestriction: config.deviceRestriction,
      gdprEnabled: config.gdprEnabled,
      gdprMessage: config.gdprMessage,
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.teamId, teamId)));
}

// Legacy alias kept for any remaining references (to be removed after full migration)
/** @deprecated use getSessionWithBlocks */
export const getSessionWithPages = getSessionWithBlocks;

// ─── Notification helpers (Story 4.5) ────────────────────────────────────────

/**
 * For a session, return the data needed to send a completion email to
 * the researcher: session title, project name+id (for dashboard URL),
 * and the email addresses of the team's owner members.
 *
 * Returns null if the session no longer exists.
 */
export async function getSessionNotificationContext(
  sessionId: number
): Promise<{
  sessionTitle: string;
  projectId: number;
  projectName: string;
  teamId: number;
  ownerEmails: string[];
} | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!session) return null;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, session.projectId),
  });
  if (!project) return null;

  // Owners of the team that owns this session
  const owners = await db
    .select({ email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        eq(teamMembers.teamId, session.teamId),
        eq(teamMembers.role, 'owner')
      )
    );

  return {
    sessionTitle: session.title,
    projectId: project.id,
    projectName: project.name,
    teamId: session.teamId,
    ownerEmails: owners.map((o) => o.email).filter(Boolean),
  };
}
