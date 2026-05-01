// POST /api/s/ai-followup
//
// Streams an AI-generated follow-up question (Server-Sent Events).
// Called from the participant client after submitting an answer to an
// open-text block where `config.aiFollowUp === true`.
//
// SSE event protocol:
//   - `event: meta`  data: {"turnId": 42}            (sent first)
//   - `event: token` data: <chunk>                   (one per delta)
//   - `event: done`  data: {"fullText": "<final>"}   (last event)
//   - `event: error` data: {"message": "..."}        (on failure, instead of done)
//
// Auth: the participantToken in the body must resolve to a participantSession
// whose sessionId matches the block's session.

import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  blockResponses,
  participantSessions,
  sessionBlocks,
  sessions,
} from '@/lib/db/schema';
import { getParticipantSession } from '@/lib/repositories/participant-sessions';
import {
  insertTurn,
  getTurnsForResponse,
} from '@/lib/repositories/ai-followup';
import {
  streamFollowupQuestion,
  type FollowupTurn,
} from '@/lib/ai/followup';
import { isAIFollowupEnabled } from '@/lib/ai/flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  participantToken: string;
  blockId: number;
  parentResponseId: number;
  turnNumber: number; // 1-indexed
}

function sseEncoder() {
  const encoder = new TextEncoder();
  return (event: string, data: string) =>
    encoder.encode(`event: ${event}\ndata: ${data}\n\n`);
}

export async function POST(req: NextRequest) {
  // Feature flag — disabled features should not consume tokens or DB rows.
  if (!isAIFollowupEnabled()) {
    return new Response('AI follow-up feature disabled', { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { participantToken, blockId, parentResponseId, turnNumber } = body;
  if (!participantToken || !blockId || !parentResponseId || !turnNumber) {
    return new Response('Missing fields', { status: 400 });
  }
  if (turnNumber < 1 || turnNumber > 3) {
    return new Response('Invalid turnNumber', { status: 400 });
  }

  // ─── Auth + load context ────────────────────────────────────────────────
  const ps = await getParticipantSession(participantToken);
  if (!ps) {
    return new Response('Forbidden', { status: 403 });
  }

  // Verify the parentResponseId + blockId belong to this participant session,
  // and the block has AI follow-up enabled. Single round-trip.
  const [ctx] = await db
    .select({
      blockType: sessionBlocks.blockType,
      blockConfig: sessionBlocks.config,
      sessionId: sessions.id,
      teamId: sessions.teamId,
      responseValue: blockResponses.value,
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
        eq(blockResponses.id, parentResponseId),
        eq(blockResponses.blockId, blockId),
        eq(participantSessions.id, ps.id)
      )
    )
    .limit(1);

  if (!ctx) {
    return new Response('Forbidden', { status: 403 });
  }

  const config = (ctx.blockConfig ?? {}) as {
    question?: string;
    aiFollowUp?: boolean;
    maxTurns?: number;
  };
  if (!config.aiFollowUp) {
    return new Response('AI follow-up not enabled for this block', {
      status: 400,
    });
  }
  const maxTurns = (config.maxTurns ?? 1) as number;
  if (turnNumber > maxTurns) {
    return new Response('Turn number exceeds maxTurns', { status: 400 });
  }
  if (ctx.blockType !== 'short_text' && ctx.blockType !== 'long_text') {
    return new Response('Block type not eligible for follow-up', {
      status: 400,
    });
  }

  const originalQuestion = config.question ?? '';
  const originalAnswer =
    typeof ctx.responseValue === 'string' ? ctx.responseValue : '';

  if (!originalAnswer.trim()) {
    return new Response('Cannot follow up on empty answer', { status: 400 });
  }

  // History = previous turns for this parent response
  const previousTurns = await getTurnsForResponse(parentResponseId);
  const history: FollowupTurn[] = previousTurns
    .filter((t) => t.turnNumber < turnNumber && t.participantAnswer)
    .map((t) => ({
      question: t.aiQuestion,
      answer: t.participantAnswer ?? '',
    }));

  // ─── Stream ──────────────────────────────────────────────────────────────
  const sse = sseEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const { stream: tokenStream, finalize } = await streamFollowupQuestion(
          {
            originalQuestion,
            originalAnswer,
            history,
            turnNumber,
            maxTurns,
          },
          { teamId: ctx.teamId, sessionId: ctx.sessionId }
        );

        for await (const tk of tokenStream) {
          controller.enqueue(sse('token', tk));
        }

        const final = await finalize();
        const cleaned = final.fullText.replace(/^["']|["']$/g, '').trim();

        // Persist the turn now that we have the full question
        const inserted = await insertTurn({
          blockId,
          parentResponseId,
          participantSessionId: ps.id,
          turnNumber,
          aiQuestion: cleaned || '(question vide)',
          participantAnswer: null,
          status: 'answered', // default — will be updated when participant replies / skips
          provider: final.provider,
          model: final.model,
        });

        // meta is sent at the end (after we have the turnId from insert)
        controller.enqueue(
          sse('meta', JSON.stringify({ turnId: inserted.id }))
        );
        controller.enqueue(
          sse('done', JSON.stringify({ fullText: cleaned }))
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message.slice(0, 200) : 'AI follow-up failed';
        // Best-effort error event for the client
        try {
          controller.enqueue(sse('error', JSON.stringify({ message })));
        } catch {
          // ignore
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no', // disable nginx buffering if proxied
    },
  });
}
