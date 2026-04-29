import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Layers } from 'lucide-react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionsByProject } from '@/lib/repositories/sessions';
import { SessionList } from './SessionList';
import { NewSessionButton } from './NewSessionButton';
import type { Session } from '@/lib/db/schema';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  if (isNaN(projectId)) notFound();

  const user = await getUser();
  if (!user) notFound();

  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  const [project, sessions] = await Promise.all([
    getProjectById(projectId, userWithTeam.teamId),
    getSessionsByProject(projectId, userWithTeam.teamId),
  ]);

  if (!project) notFound();

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Projets
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <NewSessionButton projectId={projectId} />
        </div>

        {/* Session list or empty state */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-medium text-foreground mb-1">Aucune session</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Créez votre première session de recherche pour commencer à collecter des réponses.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Sessions{' '}
              <span className="text-muted-foreground font-normal">({sessions.length})</span>
            </p>
            <SessionList sessions={sessions} projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
