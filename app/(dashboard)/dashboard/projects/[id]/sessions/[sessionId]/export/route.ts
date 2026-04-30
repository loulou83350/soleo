import { NextRequest } from 'next/server';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  listParticipantsForSession,
  getAllResponsesForSession,
} from '@/lib/repositories/participant-sessions';
import { listTagsForResponses } from '@/lib/repositories/tags';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { buildCsv, slugifyForCsv } from '@/lib/utils';
import type { SessionBlock } from '@/lib/db/schema';

interface Params {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * Story 5.4 — CSV export of all responses for one session.
 *
 * Output format:
 *  - Wide: one row per participant, one column per question
 *  - Two columns per question: <slug> (the answer) and <slug>__tags (joined labels)
 *  - Semicolon separator + UTF-8 BOM (Excel-FR friendly)
 *  - Use ?separator=, in the URL to switch to comma if you prefer
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { sessionId: sessionIdParam } = await params;
  const sessionId = parseInt(sessionIdParam, 10);
  if (isNaN(sessionId)) return new Response('Invalid sessionId', { status: 400 });

  const url = new URL(request.url);
  const separator = url.searchParams.get('separator') === ',' ? ',' : ';';

  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return new Response('Unauthorized', { status: 401 });

  const session = await getSessionWithBlocks(sessionId, userWithTeam.teamId);
  if (!session) return new Response('Not found', { status: 404 });

  // Fetch participants + all responses in parallel
  const [participants, responses] = await Promise.all([
    listParticipantsForSession(sessionId),
    getAllResponsesForSession(sessionId),
  ]);

  // Tags per response (one query)
  const tagsByResponse = await listTagsForResponses(responses.map((r) => r.responseId));

  // Index responses by participantSessionId for O(1) lookup
  const responsesByParticipant = new Map<number, Map<number, { responseId: number; value: unknown }>>();
  for (const r of responses) {
    if (!responsesByParticipant.has(r.participantSessionId)) {
      responsesByParticipant.set(r.participantSessionId, new Map());
    }
    responsesByParticipant
      .get(r.participantSessionId)!
      .set(r.blockId, { responseId: r.responseId, value: r.value });
  }

  // Order question blocks (skip welcome / thank_you anchors)
  const questionBlocks = [...session.blocks]
    .sort((a, b) => a.position - b.position)
    .filter(
      (b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as 'welcome' | 'thank_you')
    );

  // Build header
  const baseColumns = [
    'participant_id',
    'status',
    'started_at',
    'completed_at',
    'duration_seconds',
  ];
  const questionColumns: string[] = [];
  // For each question block, two columns: value + tags. Use a unique slug
  // (suffix the index) to avoid clashes when two blocks have the same label.
  questionBlocks.forEach((block, idx) => {
    const config = (block.config ?? {}) as Record<string, unknown>;
    const label =
      typeof config.question === 'string' && config.question
        ? (config.question as string)
        : block.blockType;
    const slug = `q${idx + 1}_${slugifyForCsv(label)}`;
    questionColumns.push(slug, `${slug}__tags`);
  });

  const header = [...baseColumns, ...questionColumns];

  // Build rows
  const rows: unknown[][] = participants.map((p) => {
    const row: unknown[] = [
      p.participantToken,
      p.status,
      p.startedAt.toISOString(),
      p.completedAt ? p.completedAt.toISOString() : '',
      p.durationSec ?? '',
    ];

    const partResponses = responsesByParticipant.get(p.id) ?? new Map();

    for (const block of questionBlocks) {
      const r = partResponses.get(block.id);
      if (!r) {
        row.push('', '');
        continue;
      }
      row.push(formatValueForCsv(block, r.value));
      const tags = tagsByResponse.get(r.responseId) ?? [];
      row.push(tags.map((t) => t.tag.label).join(', '));
    }
    return row;
  });

  const csv = buildCsv({ header, rows, separator });

  // Filename: soleo-<sessionTitle>-YYYY-MM-DD.csv
  const date = new Date().toISOString().slice(0, 10);
  const titleSlug = slugifyForCsv(session.title, 40) || 'session';
  const filename = `soleo-${titleSlug}-${date}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ─── Per-block-type formatter ────────────────────────────────────────────────

function formatValueForCsv(block: SessionBlock, value: unknown): string {
  if (value == null) return '';
  switch (block.blockType) {
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value : String(value);
    case 'mcq':
      return Array.isArray(value) ? (value as string[]).join(' | ') : '';
    case 'likert':
    case 'rating':
    case 'nps':
      return typeof value === 'number' ? String(value) : String(value);
    case 'card_sort':
      return Array.isArray(value)
        ? (value as Array<{ label?: string }>).map((i) => i.label ?? '').filter(Boolean).join(' > ')
        : '';
    case 'matrix':
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(value as Record<string, string>)
          .map(([row, col]) => `${row}: ${col}`)
          .join(' | ');
      }
      return '';
    case 'first_impression':
      return value === 'seen' ? 'seen' : '';
    case 'prototype_task': {
      const r = value as {
        completed?: boolean;
        skipped?: boolean;
        manualCompletion?: boolean;
        goalReached?: boolean;
        timeOnTask?: number | null;
      };
      const status = r.skipped
        ? 'skipped'
        : r.goalReached
          ? 'goal_reached'
          : r.manualCompletion
            ? 'manual_complete'
            : r.completed
              ? 'completed'
              : 'in_progress';
      const sec = r.timeOnTask != null ? Math.round(r.timeOnTask / 1000) : '';
      return sec === '' ? status : `${status} (${sec}s)`;
    }
    default:
      try { return JSON.stringify(value); } catch { return ''; }
  }
}
