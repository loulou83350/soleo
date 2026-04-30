'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteSessionAction } from './sessions/actions';
import type { Session } from '@/lib/db/schema';

function SessionCard({ session, projectId, onDeleted }: {
  session: Session;
  projectId: number;
  onDeleted: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  };

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteSessionAction(session.id);
    setDeleting(false);
    if (result.success) {
      toast.success('Session supprimée');
      onDeleted(session.id);
    } else {
      toast.error(result.error ?? 'Erreur lors de la suppression');
    }
    setConfirmOpen(false);
  }

  return (
    <div className="relative group border border-border rounded-lg hover:border-foreground/20 transition-colors">
      <Link
        href={
          session.status === 'draft'
            ? `/dashboard/projects/${projectId}/sessions/${session.id}/builder`
            : `/dashboard/projects/${projectId}/sessions/${session.id}`
        }
        className="block p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-8">
            <p className="text-sm font-medium text-foreground truncate">
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

      {/* Delete button */}
      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Supprimer la session"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded text-muted-foreground/0 group-hover:text-muted-foreground/50 hover:!text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-background border border-border rounded-lg px-2 py-1 shadow-sm">
          <span className="text-xs text-foreground whitespace-nowrap">Supprimer ?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50 flex items-center gap-1"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Oui
          </button>
          <button
            onClick={() => setConfirmOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Non
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionList({ sessions, projectId }: {
  sessions: Session[];
  projectId: number;
}) {
  const [items, setItems] = useState(sessions);

  function handleDeleted(id: number) {
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-2">
      {items.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          projectId={projectId}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
