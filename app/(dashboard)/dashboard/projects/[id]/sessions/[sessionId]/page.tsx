import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, CheckCircle2, Percent, Clock } from 'lucide-react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  getSessionStats,
  listParticipantsForSession,
} from '@/lib/repositories/participant-sessions';
import { formatDuration, formatPercent } from '@/lib/utils';
import { SessionDashboardHeader } from './SessionDashboardHeader';
import { MetricCard } from './MetricCard';
import { ParticipantTable } from './ParticipantTable';

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function SessionDashboardPage({ params }: Props) {
  const { id, sessionId: sessionIdParam } = await params;
  const projectId = parseInt(id, 10);
  const sessionId = parseInt(sessionIdParam, 10);

  if (isNaN(projectId) || isNaN(sessionId)) notFound();

  const user = await getUser();
  if (!user) notFound();

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  const [project, session, stats, participants] = await Promise.all([
    getProjectById(projectId, userWithTeam.teamId),
    getSessionWithBlocks(sessionId, userWithTeam.teamId),
    getSessionStats(sessionId),
    listParticipantsForSession(sessionId),
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

        {/* Metrics */}
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

        {/* Participants list */}
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
                {session.status === 'published'
                  ? 'En attente du premier participant. Partagez le lien public pour collecter des réponses.'
                  : 'Cette session n’est pas encore publiée.'}
              </p>
            </div>
          ) : (
            <ParticipantTable
              rows={participants}
              projectId={projectId}
              sessionId={session.id}
            />
          )}
        </section>
      </div>
    </div>
  );
}
