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
import { formatDuration, formatRelativeDate } from '@/lib/utils';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { ResponseRenderer } from './ResponseRenderer';
import type { SessionBlock } from '@/lib/db/schema';

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

  const isCompleted = participant.status === 'completed';
  const durationSec =
    participant.completedAt && participant.startedAt
      ? Math.round(
          (participant.completedAt.getTime() - participant.startedAt.getTime()) / 1000
        )
      : null;

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
            answerBlocks.map((block, idx) => (
              <BlockAnswer
                key={block.id}
                block={block}
                index={idx + 1}
                value={responseMap.get(block.id) ?? null}
              />
            ))
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
}: {
  block: SessionBlock;
  index: number;
  value: unknown;
}) {
  const config = (block.config ?? {}) as Record<string, unknown>;
  const question =
    typeof config.question === 'string' && config.question
      ? (config.question as string)
      : typeof config.title === 'string' && config.title
        ? (config.title as string)
        : blockTypeLabel(block.blockType);

  return (
    <article className="border border-border rounded-lg p-5 bg-background space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">
          <span className="text-muted-foreground tabular-nums mr-2">{index}.</span>
          {question}
        </h2>
        <span className="text-xs text-muted-foreground shrink-0">
          {blockTypeLabel(block.blockType)}
        </span>
      </header>

      <ResponseRenderer block={block} value={value} />
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
