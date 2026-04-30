'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, FolderOpen, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createProjectAction, deleteProjectAction } from './actions';
import type { Project } from '@/lib/db/schema';
import { track } from '@/lib/analytics/track';

interface ProjectsClientProps {
  initialProjects: Project[];
}

// ─── Dialog de création ──────────────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (result.success) {
        track('project_created', { project_id: result.data.id });
        onCreated(result.data);
        onClose();
        toast.success('Projet créé avec succès');
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-lg"
      >
        <h2 id="create-dialog-title" className="text-lg font-semibold text-foreground mb-4">
          Nouveau projet
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-sm font-medium text-foreground">
              Nom du projet
            </Label>
            <Input
              id="project-name"
              name="name"
              type="text"
              placeholder="ex : Refonte application mobile"
              maxLength={100}
              required
              autoFocus
              className="border-border focus-visible:ring-foreground"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création…
                </>
              ) : (
                'Créer le projet'
              )}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Dialog de suppression (destructive) ────────────────────────────────────

function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: Project;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set('projectId', String(project.id));

    startTransition(async () => {
      const result = await deleteProjectAction(formData);
      if (result.success) {
        onDeleted(project.id);
        onClose();
        toast.success('Projet supprimé');
      } else {
        toast.error(result.error);
        onClose();
      }
    });
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-lg"
      >
        <h2 id="delete-dialog-title" className="text-lg font-semibold text-foreground mb-2">
          Supprimer « {project.name} » ?
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Cette action est irréversible. Le projet et toutes ses sessions seront définitivement supprimés.
        </p>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suppression…
              </>
            ) : (
              'Supprimer définitivement'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Liste des projets ───────────────────────────────────────────────────────

export function ProjectsClient({ initialProjects }: ProjectsClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  function handleCreated(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  function handleDeleted(id: number) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">Projets</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-base font-medium text-foreground mb-1">
            Aucun projet
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Créez votre premier projet pour organiser vos sessions de recherche.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau projet
          </Button>
        </div>
      ) : (
        /* Project list */
        <ul className="space-y-2" role="list">
          {projects.map((project) => (
            <li
              key={project.id}
              className="group flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 hover:border-foreground/20 transition-colors cursor-pointer"
              onClick={() =>
                router.push(`/dashboard/projects/${project.id}`)
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    0 session · Créé le{' '}
                    {new Date(project.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={`Supprimer le projet ${project.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(project);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Dialogs */}
      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      {deleteTarget && (
        <DeleteProjectDialog
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
