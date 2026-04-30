import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, CheckCircle2, Percent, Clock } from 'lucide-react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  getSessionStats,
  listParticipantsForSession,
  getAllResponsesForSession,
} from '@/lib/repositories/participant-sessions';
import { countTagUsageForSession } from '@/lib/repositories/tags';
import { formatDuration, formatPercent } from '@/lib/utils';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { summarizeForBlock } from '@/lib/analytics/summaries';
import { SessionDashboardHeader } from './SessionDashboardHeader';
import { MetricCard } from './MetricCard';
import { ParticipantTable } from './ParticipantTable';
import { BlockSummaryRenderer } from './BlockSummaryRenderer';
import { TagChip } from '@/components/insights/TagChip';
import type { SessionBlock, InsightTag } from '@/lib/db/schema';

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function SessionDashboardPage({ params, searchParams }: Props) {
  const { id, sessionId: sessionIdParam } = await params;
  const { view } = await searchParams;
  const projectId = parseInt(id, 10);
  const sessionId = parseInt(sessionIdParam, 10);

  if (isNaN(projectId) || isNaN(sessionId)) notFound();

  const user = await getUser();
  if (!user) notFound();

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  const isSummaryView = view === 'summary';

  // Always fetch the cheap stuff. Heavy summary fetch only when needed.
  const [project, session, stats, participants, allResponses, tagUsageByBlock] =
    await Promise.all([
      getProjectById(projectId, userWithTeam.teamId),
      getSessionWithBlocks(sessionId, userWithTeam.teamId),
      getSessionStats(sessionId),
      listParticipantsForSession(sessionId),
      isSummaryView ? getAllResponsesForSession(sessionId) : Promise.resolve([]),
      isSummaryView
        ? countTagUsageForSession(sessionId)
        : Promise.resolve(new Map<number, Map<number, { tag: InsightTag; count: number }>>()),
    ]);

  if (!project || !session) notFound();

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {project.name}
        </Link>

        {/* Header */}
        <SessionDashboardHeader
          title={session.title}
          status={session.status}
          sessionToken={session.sessionToken}
          sessionId={session.id}
          projectId={projectId}
        />

        {/* Metrics — always visible regardless of tab */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Démarrés"
            value={stats.totalParticipants}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            label="Complétés"
            value={stats.completedCount}
            subtitle={
              stats.inProgressCount > 0
                ? `${stats.inProgressCount} en cours`
                : undefined
            }
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Taux de complétion"
            value={formatPercent(stats.completionRate)}
            icon={<Percent className="h-4 w-4" />}
          />
          <MetricCard
            label="Durée moyenne"
            value={formatDuration(stats.avgDurationSec)}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Tabs */}
        <Tabs projectId={projectId} sessionId={session.id} active={isSummaryView ? 'summary' : 'participants'} />

        {/* Tab content */}
        {isSummaryView ? (
          <SummaryView
            blocks={session.blocks}
            responses={allResponses}
            tagUsageByBlock={tagUsageByBlock}
          />
        ) : (
          <ParticipantsView
            participants={participants}
            sessionStatus={session.status}
            projectId={projectId}
            sessionId={session.id}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function Tabs({
  projectId,
  sessionId,
  active,
}: {
  projectId: number;
  sessionId: number;
  active: 'participants' | 'summary';
}) {
  const tabBase =
    'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px';
  const activeCls = 'border-foreground text-foreground';
  const inactiveCls = 'border-transparent text-muted-foreground hover:text-foreground';

  return (
    <nav className="flex items-center gap-2 border-b border-border">
      <Link
        href={`/dashboard/projects/${projectId}/sessions/${sessionId}`}
        className={`${tabBase} ${active === 'participants' ? activeCls : inactiveCls}`}
      >
        Participants
      </Link>
      <Link
        href={`/dashboard/projects/${projectId}/sessions/${sessionId}?view=summary`}
        className={`${tabBase} ${active === 'summary' ? activeCls : inactiveCls}`}
      >
        Récap par question
      </Link>
    </nav>
  );
}

// ─── Tab: Participants ──────────────────────────────────────────────────────

function ParticipantsView({
  participants,
  sessionStatus,
  projectId,
  sessionId,
}: {
  participants: Awaited<ReturnType<typeof listParticipantsForSession>>;
  sessionStatus: string;
  projectId: number;
  sessionId: number;
}) {
  return (
    <section className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Participants{' '}
        <span className="text-muted-foreground font-normal">
          ({participants.length})
        </span>
      </p>

      {participants.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {sessionStatus === 'published'
              ? 'En attente du premier participant. Partagez le lien public pour collecter des réponses.'
              : 'Cette session n’est pas encore publiée.'}
          </p>
        </div>
      ) : (
        <ParticipantTable
          rows={participants}
          projectId={projectId}
          sessionId={sessionId}
        />
      )}
    </section>
  );
}

// ─── Tab: Récap par question ─────────────────────────────────────────────────

function SummaryView({
  blocks,
  responses,
  tagUsageByBlock,
}: {
  blocks: SessionBlock[];
  responses: Array<{ blockId: number; value: unknown }>;
  tagUsageByBlock: Map<number, Map<number, { tag: InsightTag; count: number }>>;
}) {
  // Group raw values by blockId
  const byBlock = new Map<number, unknown[]>();
  for (const r of responses) {
    if (!byBlock.has(r.blockId)) byBlock.set(r.blockId, []);
    byBlock.get(r.blockId)!.push(r.value);
  }

  // Order blocks; skip welcome / thank_you anchors
  const orderedBlocks = [...blocks]
    .sort((a, b) => a.position - b.position)
    .filter((b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as 'welcome' | 'thank_you'));

  if (orderedBlocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cette session ne contient aucun bloc de question.
      </p>
    );
  }

  return (
    <section className="space-y-6">
      {orderedBlocks.map((block, idx) => {
        const config = (block.config ?? {}) as Record<string, unknown>;
        const values = byBlock.get(block.id) ?? [];
        const summary = summarizeForBlock(block.blockType, config, values);
        const question =
          typeof config.question === 'string' && config.question
            ? (config.question as string)
            : typeof config.title === 'string' && config.title
              ? (config.title as string)
              : blockTypeLabel(block.blockType);

        return (
          <article
            key={block.id}
            className="border border-border rounded-lg p-5 bg-background space-y-4"
          >
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">
                <span className="text-muted-foreground tabular-nums mr-2">
                  {idx + 1}.
                </span>
                {question}
              </h2>
              <span className="text-xs text-muted-foreground shrink-0">
                {blockTypeLabel(block.blockType)}
              </span>
            </header>
            <BlockSummaryRenderer summary={summary} />

            {/* Tag distribution for this block */}
            {(() => {
              const tagsForBlock = tagUsageByBlock.get(block.id);
              if (!tagsForBlock || tagsForBlock.size === 0) return null;
              const sorted = Array.from(tagsForBlock.values()).sort(
                (a, b) => b.count - a.count
              );
              return (
                <div className="pt-3 border-t border-border/60 space-y-2">
                  <p className="text-xs text-muted-foreground">Tags appliqués</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sorted.map(({ tag, count }) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1.5"
                      >
                        <TagChip label={tag.label} color={tag.color} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          ×{count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </article>
        );
      })}
    </section>
  );
}

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
