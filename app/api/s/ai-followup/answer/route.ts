// POST /api/s/ai-followup/answer
//
// Records the participant's answer (or skip) to an AI-generated follow-up
// question. Updates the existing ai_followup_turns row created by the
// /api/s/ai-followup endpoint.
//
// Body: { participantToken, turnId, action: 'answer' | 'skip', answer? }

import { NextRequest } from 'next/server';
import { getParticipantSession } from '@/lib/repositories/participant-sessions';
import { updateTurnAnswer } from '@/lib/repositories/ai-followup';

export const runtime = 'nodejs';

interface Body {
  participantToken: string;
  turnId: number;
  action: 'answer' | 'skip';
  answer?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { participantToken, turnId, action } = body;
  if (!participantToken || !turnId || !action) {
    return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 });
  }
  if (action !== 'answer' && action !== 'skip') {
    return Response.json({ ok: false, error: 'Invalid action' }, { status: 400 });
  }

  const ps = await getParticipantSession(participantToken);
  if (!ps) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const updated = await updateTurnAnswer(
    turnId,
    ps.id,
    action === 'answer' ? (body.answer ?? '') : null,
    action === 'answer' ? 'answered' : 'skipped'
  );

  if (!updated) {
    return Response.json({ ok: false, error: 'Turn not found' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
