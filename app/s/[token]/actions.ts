'use server';

import { getSessionByToken } from '@/lib/repositories/sessions';
import {
  startParticipantSession,
  getParticipantSession,
  completeParticipantSession,
  upsertBlockResponse,
} from '@/lib/repositories/participant-sessions';
import { recordConsent } from '@/lib/repositories/consent';
import { comparePasswords } from '@/lib/auth/session';
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
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de sauvegarder la réponse' };
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
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: 'Impossible de compléter la session' };
  }
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
