'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Clock, FileText, Loader2 } from 'lucide-react';
import { TEMPLATES } from '@/lib/domain/templates';
import { createSessionFromTemplateAction, createSessionAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';

// ─── Category badge colors ───────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Prototype:    'bg-blue-50 text-blue-700 border-blue-200',
  Sondage:      'bg-green-50 text-green-700 border-green-200',
  Architecture: 'bg-purple-50 text-purple-700 border-purple-200',
  Design:       'bg-amber-50 text-amber-700 border-amber-200',
  Entretien:    'bg-rose-50 text-rose-700 border-rose-200',
};

// ─── TemplatePickerModal ─────────────────────────────────────────────────────

interface TemplatePickerModalProps {
  projectId: number;
  onClose: () => void;
}

export function TemplatePickerModal({ projectId, onClose }: TemplatePickerModalProps) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null); // templateId or 'blank'
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleTemplate(templateId: string) {
    if (creating) return;
    setCreating(templateId);
    const result = await createSessionFromTemplateAction(projectId, templateId);
    if (result.success) {
      router.push(`/dashboard/projects/${projectId}/sessions/${result.data.sessionId}/builder`);
    } else {
      setCreating(null);
      alert(result.error);
    }
  }

  async function handleBlank() {
    if (creating) return;
    setCreating('blank');
    const fd = new FormData();
    fd.append('projectId', String(projectId));
    await createSessionAction(fd);
    // createSessionAction does a server-side redirect, so we won't reach here
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un template"
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Nouvelle session</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Démarrez depuis un template ou créez une session vide.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Blank session */}
            <button
              onClick={handleBlank}
              disabled={!!creating}
              className="group relative text-left border-2 border-dashed border-border rounded-xl p-5 hover:border-foreground/30 hover:bg-muted/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating === 'blank' && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Session vide</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Commencez avec une page de question vierge.
                  </p>
                </div>
              </div>
            </button>

            {/* Templates */}
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplate(template.id)}
                disabled={!!creating}
                className="group relative text-left border border-border rounded-xl p-5 hover:border-foreground/30 hover:bg-muted/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating === template.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {/* Title + category */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {template.name}
                    </p>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[template.category] ?? 'bg-muted text-muted-foreground border-border'}`}>
                      {template.category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {template.description}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      ~{template.estimatedMinutes} min
                    </span>
                    <span>
                      {template.blocks.filter((b) => b.blockType !== 'welcome' && b.blockType !== 'thank_you').length} étape{template.blocks.filter((b) => b.blockType !== 'welcome' && b.blockType !== 'thank_you').length > 1 ? 's' : ''}
                    </span>
                    <span>
                      {template.blocks.length} blocs
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
