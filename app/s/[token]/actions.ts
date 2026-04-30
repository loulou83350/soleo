'use server';

import { eq, and } from 'drizzle-orm';
import {
  getSessionByToken,
  getSessionNotificationContext,
} from '@/lib/repositories/sessions';
import {
  startParticipantSession,
  getParticipantSession,
  completeParticipantSession,
  upsertBlockResponse,
  countCompletedParticipants,
} from '@/lib/repositories/participant-sessions';
import { recordConsent } from '@/lib/repositories/consent';
import {
  attachTag,
  findOrCreateTagByLabel,
  listTeamTags,
} from '@/lib/repositories/tags';
import { db } from '@/lib/db/drizzle';
import {
  blockResponses,
  sessionBlocks,
  participantSessions,
  sessions,
} from '@/lib/db/schema';
import { suggestTagsForResponse } from '@/lib/ai/providers';
import { comparePasswords } from '@/lib/auth/session';
import { sendSessionCompletionEmail } from '@/lib/email/resend';
import type { SessionWithBlocks } from '@/lib/db/schema';
import type { ActionResult } from '@/lib/domain/types';

// ─── Start or resume a participant session ────────────────────────────────────

/**
 * Called on first load (no existing participantToken in sessionStorage).
 * Validates the token, creates a participant session, returns the session data.
 */
export async function startSessionAction(
  sessionToken: string
): Promise<ActionResult<{ participantToken: string; session: SessionWithBlocks }>> {
  const session = await getSessionByToken(sessionToken);

  if (!session || session.status !== 'published') {
    return { success: false, error: 'Session introuvable ou non publiée' };
  }

  try {
    const participantSession = await startParticipantSession(session.id);
    return {
      success: true,
      data: {
        participantToken: participantSession.participantToken,
        session,
      },
    };
  } catch {
    return { success: false, error: 'Impossible de démarrer la session' };
  }
}

/**
 * Called when resuming — validates the participantToken still exists.
 */
export async function resumeSessionAction(
  sessionToken: string,
  participantToken: string
): Promise<ActionResult<{ session: SessionWithBlocks }>> {
  const session = await getSessionByToken(sessionToken);
  if (!session || session.status !== 'published') {
    return { success: false, error: 'Session introuvable' };
  }

  const participantSession = await getParticipantSession(participantToken);
  if (!participantSession || participantSession.sessionId !== session.id) {
    return { success: false, error: 'Session participant introuvable' };
  }

  return { success: true, data: { session } };
}

// ─── Save a block response ────────────────────────────────────────────────────

export async function saveBlockResponseAction(
  participantToken: string,
  blockId: number,
  value: unknown
): Promise<ActionResult<void>> {
  const participantSession = await getParticipantSession(participantToken);
  if (!participantSession) {
    return { success: false, error: 'Session participant introuvable' };
  }

  try {
    await upsertBlockResponse(participantSession.id, blockId, value);

    // Story 5.3 — auto-tagging hook (off by default).
    // Runs in the background, never blocks the participant flow.
    if (process.env.AI_AUTO_TAG === 'true') {
      autoTagResponse(participantSession.id, blockId, value).catch((err) => {
        console.error('[ai-auto-tag] failed:', err);
      });
    }

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de sauvegarder la réponse' };
  }
}

/**
 * Story 5.3 — fire-and-forget auto-tagging. Runs the configured AI provider
 * over the just-saved response and attaches up to 3 tags with source='ai_auto'.
 * Errors are logged but never thrown; the response itself is already persisted.
 */
async function autoTagResponse(
  participantSessionId: number,
  blockId: number,
  value: unknown
): Promise<void> {
  // Look up the response row + block + team
  const [row] = await db
    .select({
      responseId: blockResponses.id,
      blockType: sessionBlocks.blockType,
      blockConfig: sessionBlocks.config,
      teamId: sessions.teamId,
    })
    .from(blockResponses)
    .innerJoin(sessionBlocks, eq(blockResponses.blockId, sessionBlocks.id))
    .innerJoin(
      participantSessions,
      eq(blockResponses.participantSessionId, participantSessions.id)
    )
    .innerJoin(sessions, eq(participantSessions.sessionId, sessions.id))
    .where(
      and(
        eq(blockResponses.participantSessionId, participantSessionId),
        eq(blockResponses.blockId, blockId)
      )
    )
    .limit(1);
  if (!row) return;

  // Extract a textual representation
  const text = stringifyValueForAI(row.blockType, value);
  if (!text.trim()) return;

  const teamTags = await listTeamTags(row.teamId);
  const config = (row.blockConfig ?? {}) as Record<string, unknown>;
  const question =
    typeof config.question === 'string' ? (config.question as string) : undefined;

  const suggestions = await suggestTagsForResponse({
    responseText: text,
    blockType: row.blockType,
    question,
    existingTags: teamTags.map((t) => t.label),
    usage: {
      teamId: row.teamId,
      userId: null, // system-attributed (participant flow, no logged-in user)
      feature: 'auto_tag',
    },
  });

  for (const s of suggestions) {
    const tag = await findOrCreateTagByLabel({
      teamId: row.teamId,
      userId: null, // system-attributed
      label: s.label,
      color: 'gray',
    });
    await attachTag({
      responseId: row.responseId,
      tagId: tag.id,
      source: 'ai_auto',
      teamId: row.teamId,
    });
  }
}

function stringifyValueForAI(blockType: string, value: unknown): string {
  if (value == null) return '';
  switch (blockType) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : '';
    case 'mcq':
      return Array.isArray(value) ? (value as string[]).join(', ') : '';
    default:
      return ''; // only auto-tag textual / categorical responses for now
  }
}

// ─── Complete a session ───────────────────────────────────────────────────────

export async function completeSessionAction(
  participantToken: string
): Promise<ActionResult<void>> {
  const participantSession = await getParticipantSession(participantToken);
  if (!participantSession) {
    return { success: false, error: 'Session participant introuvable' };
  }

  try {
    await completeParticipantSession(participantSession.id);

    // Story 4.5 — fire-and-forget notification email to team owners.
    // Errors are logged but never block the participant response.
    notifySessionOwners(participantSession.sessionId).catch((err) => {
      console.error('[completion-email] notification failed:', err);
    });

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de compléter la session' };
  }
}

/**
 * Looks up the session's owner emails and sends a completion notification
 * to each. Designed to run after completeParticipantSession() resolves —
 * the count therefore includes the just-completed participant.
 */
async function notifySessionOwners(sessionId: number): Promise<void> {
  const ctx = await getSessionNotificationContext(sessionId);
  if (!ctx || ctx.ownerEmails.length === 0) {
    console.log('[completion-email] no owners to notify for session', sessionId);
    return;
  }

  const participantNumber = await countCompletedParticipants(sessionId);
  console.log(
    `[completion-email] sending to ${ctx.ownerEmails.length} owner(s):`,
    ctx.ownerEmails.join(', ')
  );

  // Send in parallel; individual failures don't abort the whole batch
  // but each one is logged so we don't lose track of Resend rejections.
  const results = await Promise.allSettled(
    ctx.ownerEmails.map((email) =>
      sendSessionCompletionEmail({
        to: email,
        sessionTitle: ctx.sessionTitle,
        projectName: ctx.projectName,
        projectId: ctx.projectId,
        sessionId,
        participantNumber,
      })
    )
  );

  results.forEach((result, idx) => {
    const email = ctx.ownerEmails[idx];
    if (result.status === 'rejected') {
      console.error(`[completion-email] FAILED for ${email}:`, result.reason);
    } else {
      console.log(`[completion-email] sent OK to ${email}`);
    }
  });
}

// ─── Gate: password check ────────────────────────────────────────────────────

/**
 * Validates the participant-supplied password against the session's bcrypt hash.
 */
export async function checkPasswordAction(
  sessionToken: string,
  password: string
): Promise<ActionResult<void>> {
  const session = await getSessionByToken(sessionToken);
  if (!session) {
    return { success: false, error: 'Session introuvable' };
  }
  if (!session.passwordHash) {
    // No password set — gate is open
    return { success: true, data: undefined };
  }

  const valid = await comparePasswords(password, session.passwordHash);
  if (!valid) {
    return { success: false, error: 'Mot de passe incorrect' };
  }

  return { success: true, data: undefined };
}

// ─── Gate: record GDPR consent ────────────────────────────────────────────────

/**
 * Records an immutable consent acceptance for the participant.
 * `ipHash` is a SHA-256 hash of the participant's IP, computed client-side
 * or passed as null if unavailable.
 */
export async function recordConsentAction(
  participantToken: string,
  ipHash: string | null
): Promise<ActionResult<void>> {
  const participantSession = await getParticipantSession(participantToken);
  if (!participantSession) {
    return { success: false, error: 'Session participant introuvable' };
  }

  try {
    await recordConsent(participantSession.id, ipHash);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible d\'enregistrer le consentement' };
  }
}
