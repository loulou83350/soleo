import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Layers, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionsByProject } from '@/lib/repositories/sessions';
import { createSessionAction } from './sessions/actions';
import type { Session } from '@/lib/db/schema';

interface Props {
  params: Promise<{ id: string }>;
}

function SessionCard({ session, projectId }: { session: Session; projectId: number }) {
  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  };

  return (
    <Link
      href={`/dashboard/projects/${projectId}/sessions/${session.id}/builder`}
      className="block border border-border rounded-lg p-4 hover:bg-muted/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-foreground">
            {session.title}
          </p>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {new Date(session.updatedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
            session.status === 'published'
              ? 'bg-success/15 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {statusLabel[session.status] ?? session.status}
        </span>
      </div>
    </Link>
  );
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
          <form action={createSessionAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle session
            </Button>
          </form>
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
            <div className="space-y-2">
              {sessions.map((session) => (
                <SessionCard key={session.id} session={session} projectId={projectId} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
