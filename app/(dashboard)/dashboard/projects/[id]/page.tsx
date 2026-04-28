import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/db/queries';
import { getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';

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

  const project = await getProjectById(projectId, userWithTeam.teamId);
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
          <h1 className="text-xl font-semibold text-foreground">
            {project.name}
          </h1>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled
            title="Disponible dans une prochaine story"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle session
          </Button>
        </div>

        {/* Empty state sessions */}
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Layers className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-base font-medium text-foreground mb-1">
            Aucune session
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Créez votre première session de recherche pour commencer à collecter des réponses.
          </p>
        </div>
      </div>
    </div>
  );
}
