import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  getParticipantSession,
  getBlockResponses,
} from '@/lib/repositories/participant-sessions';
import { listTeamTags, listTagsForResponses } from '@/lib/repositories/tags';
import { listPinnedResponseIdsForSession } from '@/lib/repositories/findings';
import { getTurnsForResponses } from '@/lib/repositories/ai-followup';
import {
  parseFigmaProtoUrl,
  fetchFigmaFrames,
  fetchFigmaThumbnails,
} from '@/lib/figma/api';
import { resolveFigmaToken } from '@/lib/figma/auth';
import {
  getActiveProvider,
  getAvailableProviders,
} from '@/lib/ai/providers';
import { formatDuration, formatRelativeDate } from '@/lib/utils';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { ResponseRenderer } from './ResponseRenderer';
import { TagEditor } from '@/components/insights/TagEditor';
import { PinHighlightButton } from '@/components/findings/PinHighlightButton';
import {
  AIConversationThread,
  AIBadge,
} from '@/components/dashboard/AIConversationThread';
import type {
  SessionBlock,
  InsightTag,
  TagSource,
  AIFollowupTurn,
} from '@/lib/db/schema';

interface Props {
  params: Promise<{ id: string; sessionId: string; participantToken: string }>;
}

export default async function ParticipantDetailPage({ params }: Props) {
  const { id, sessionId: sessionIdParam, participantToken } = await params;
  const projectId = parseInt(id, 10);
  const sessionId = parseInt(sessionIdParam, 10);

  if (isNaN(projectId) || isNaN(sessionId)) notFound();

  const user = await getUser();
  if (!user) notFound();

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  const [project, session, participant] = await Promise.all([
    getProjectById(projectId, userWithTeam.teamId),
    getSessionWithBlocks(sessionId, userWithTeam.teamId),
    getParticipantSession(participantToken),
  ]);

  if (!project || !session || !participant) notFound();
  // Cross-check: participant must belong to this session
  if (participant.sessionId !== session.id) notFound();

  const responses = await getBlockResponses(participant.id);
  const responseMap = new Map(responses.map((r) => [r.blockId, r.value]));
  // blockId → response.id (needed to wire the TagEditor)
  const responseIdByBlockId = new Map(responses.map((r) => [r.blockId, r.id]));

  // Fetch tag attachments + team library + pinned highlights + AI follow-ups in parallel
  const [tagsByResponse, teamTags, pinnedResponseIds, turnsByResponse] =
    await Promise.all([
      listTagsForResponses(responses.map((r) => r.id)),
      listTeamTags(userWithTeam.teamId),
      listPinnedResponseIdsForSession(sessionId),
      getTurnsForResponses(responses.map((r) => r.id)),
    ]);
  const availableProviders = getAvailableProviders();
  const activeProvider = getActiveProvider();

  const isCompleted = participant.status === 'completed';
  const durationSec =
    participant.completedAt && participant.startedAt
      ? Math.round(
          (participant.completedAt.getTime() - participant.startedAt.getTime()) / 1000
        )
      : null;

  // Story 9.2 — pre-fetch frame lookup per prototype_task block (best-effort, parallel)
  const frameLookups = await buildFrameLookups({
    userId: user.id,
    blocks: session.blocks,
    responseMap,
  });

  // Order blocks by position; skip pure-anchor blocks for the answer list
  const orderedBlocks = [...session.blocks].sort((a, b) => a.position - b.position);
  const answerBlocks = orderedBlocks.filter(
    (b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as 'welcome' | 'thank_you')
  );

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <Link
          href={`/dashboard/projects/${projectId}/sessions/${sessionId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {session.title}
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">
              Participant ·{' '}
              <span className="font-mono text-sm text-muted-foreground">
                {participant.participantToken.slice(0, 8)}…
              </span>
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isCompleted
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isCompleted ? 'Complété' : 'En cours'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span>Démarré {formatRelativeDate(participant.startedAt)}</span>
            {participant.completedAt && (
              <span>Terminé {formatRelativeDate(participant.completedAt)}</span>
            )}
            {durationSec != null && (
              <span className="tabular-nums">Durée : {formatDuration(durationSec)}</span>
            )}
          </div>
        </div>

        {/* Answer list */}
        <section className="space-y-6">
          {answerBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cette session ne contient aucun bloc de question.
            </p>
          ) : (
            answerBlocks.map((block, idx) => {
              const responseId = responseIdByBlockId.get(block.id);
              const attached =
                responseId != null
                  ? (tagsByResponse.get(responseId) ?? []).map((a) => ({
                      tag: a.tag,
                      source: a.source,
                    }))
                  : [];
              const turns =
                responseId != null ? turnsByResponse.get(responseId) ?? [] : [];
              const frameLookup = frameLookups.get(block.id);
              return (
                <BlockAnswer
                  key={block.id}
                  block={block}
                  index={idx + 1}
                  value={responseMap.get(block.id) ?? null}
                  responseId={responseId}
                  isPinned={responseId != null && pinnedResponseIds.has(responseId)}
                  attachedTags={attached}
                  teamTags={teamTags}
                  availableProviders={availableProviders}
                  activeProvider={activeProvider}
                  followupTurns={turns}
                  frameLookup={frameLookup}
                  context={{
                    projectId,
                    sessionId,
                    participantToken,
                  }}
                />
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Per-block answer card ───────────────────────────────────────────────────

function BlockAnswer({
  block,
  index,
  value,
  responseId,
  isPinned,
  attachedTags,
  teamTags,
  availableProviders,
  activeProvider,
  followupTurns,
  frameLookup,
  context,
}: {
  block: SessionBlock;
  index: number;
  value: unknown;
  responseId: number | undefined;
  isPinned: boolean;
  attachedTags: Array<{ tag: InsightTag; source: TagSource }>;
  teamTags: InsightTag[];
  availableProviders: ReturnType<typeof getAvailableProviders>;
  activeProvider: ReturnType<typeof getActiveProvider>;
  followupTurns: AIFollowupTurn[];
  frameLookup?: Map<string, { name?: string; thumbnailUrl?: string }>;
  context: { projectId: number; sessionId: number; participantToken: string };
}) {
  const config = (block.config ?? {}) as Record<string, unknown>;
  const question =
    typeof config.question === 'string' && config.question
      ? (config.question as string)
      : typeof config.title === 'string' && config.title
        ? (config.title as string)
        : blockTypeLabel(block.blockType);

  const hasFollowups = followupTurns.length > 0;
  const answerCount = followupTurns.filter(
    (t) => t.status === 'answered' && t.participantAnswer
  ).length;

  return (
    <article className="border border-border rounded-lg p-5 bg-background space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
          <span>
            <span className="text-muted-foreground tabular-nums mr-2">{index}.</span>
            {question}
          </span>
          {hasFollowups && <AIBadge count={answerCount} />}
        </h2>
        <span className="text-xs text-muted-foreground shrink-0">
          {blockTypeLabel(block.blockType)}
        </span>
      </header>

      {/* Either show the conversation thread (when AI follow-up turns exist),
          or the standard single-answer renderer */}
      {hasFollowups ? (
        <AIConversationThread
          originalQuestion={question}
          originalAnswer={typeof value === 'string' ? value : ''}
          turns={followupTurns}
        />
      ) : (
        <ResponseRenderer block={block} value={value} frameLookup={frameLookup} />
      )}

      {/* Tag editor + pin button — only when there's an actual response row */}
      {responseId != null && (
        <div className="pt-3 border-t border-border/60 space-y-3">
          <TagEditor
            responseId={responseId}
            initialAttached={attachedTags}
            teamTags={teamTags}
            availableProviders={availableProviders}
            activeProvider={activeProvider}
            context={context}
          />
          <PinHighlightButton responseId={responseId} initialPinned={isPinned} />
        </div>
      )}
    </article>
  );
}

// Lightweight label — doesn't need the heavy import from domain/blocks
function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    short_text: 'Texte court',
    long_text: 'Texte long',
    mcq: 'Choix multiple',
    likert: 'Échelle Likert',
    rating: 'Note',
    nps: 'NPS',
    card_sort: 'Tri de cartes',
    matrix: 'Matrice',
    first_impression: 'Premier regard',
    content: 'Contenu',
    prototype_task: 'Tâche prototype',
  };
  return labels[type] ?? type;
}

// ─── Story 9.2 — frame lookup builder ────────────────────────────────────────
//
// For every prototype_task block with navigations, fetch the Figma frame names
// + thumbnails for the unique node IDs visited. Returns a map blockId →
// (nodeId → { name, thumbnailUrl }) ready to feed <PrototypeTaskResponse/>.
//
// All Figma calls are best-effort + parallel: a single failed fetch never
// breaks the page, the timeline just falls back to "Écran indisponible".

type FrameLookup = Map<string, { name?: string; thumbnailUrl?: string }>;

async function buildFrameLookups(args: {
  userId: number;
  blocks: SessionBlock[];
  responseMap: Map<number, unknown>;
}): Promise<Map<number, FrameLookup>> {
  const out = new Map<number, FrameLookup>();

  // Token resolution happens once for the whole page render
  const figmaToken = await resolveFigmaToken(args.userId);
  if (!figmaToken) return out; // no token → no thumbnails, just nodeId fallback

  const tasks: Array<Promise<void>> = [];

  for (const block of args.blocks) {
    if (block.blockType !== 'prototype_task') continue;
    const value = args.responseMap.get(block.id);
    if (!value || typeof value !== 'object') continue;
    const navs =
      ((value as { navigations?: Array<{ nodeId: string; at: number }> })
        .navigations ?? []);
    if (navs.length === 0) continue;

    const cfg = (block.config ?? {}) as { url?: string };
    if (!cfg.url) continue;
    const parsed = parseFigmaProtoUrl(cfg.url);
    if (!parsed) continue;

    // De-duplicate node IDs (a participant can revisit the same screen)
    const uniqueIds = Array.from(new Set(navs.map((n) => n.nodeId)));

    tasks.push(
      Promise.all([
        fetchFigmaFrames(parsed.fileKey, undefined, figmaToken).catch(() => []),
        fetchFigmaThumbnails(parsed.fileKey, uniqueIds, figmaToken).catch(() => ({} as Record<string, string>)),
      ]).then(([frames, thumbs]) => {
        const map: FrameLookup = new Map();
        for (const id of uniqueIds) {
          const frame = frames.find((f) => f.id === id);
          map.set(id, {
            name: frame?.name,
            thumbnailUrl: thumbs[id],
          });
        }
        out.set(block.id, map);
      })
    );
  }

  await Promise.all(tasks);
  return out;
}
