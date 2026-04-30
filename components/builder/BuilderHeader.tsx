'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Share2, Check, Loader2, Copy, AlertCircle, X, Eye, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateSessionTitleAction, publishSessionAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';
import type { ValidationIssue } from '@/lib/domain/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type PublishStatus = 'idle' | 'publishing';

interface BuilderHeaderProps {
  sessionId: number;
  projectId: number;
  initialTitle: string;
  initialStatus: string;
  initialToken: string | null;
  initialGate?: {
    passwordEnabled: boolean;
    deviceRestriction: 'any' | 'desktop' | 'mobile';
    gdprEnabled: boolean;
    gdprMessage: string;
  };
  onPreview: () => void;
  onGatePanel?: (open: boolean) => void;
}

export function BuilderHeader({
  sessionId,
  projectId,
  initialTitle,
  initialStatus,
  initialToken,
  onPreview,
  onGatePanel,
}: BuilderHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);

  // Publish state
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [sessionToken, setSessionToken] = useState<string | null>(initialToken);
  const isPublished = sessionToken !== null;
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [showIssues, setShowIssues] = useState(false);

  latestTitle.current = title;

  const save = useCallback(
    async (value: string) => {
      if (!value.trim()) return;
      setSaveStatus('saving');
      try {
        const result = await updateSessionTitleAction(sessionId, value);
        setSaveStatus(result.success ? 'saved' : 'error');
      } catch {
        setSaveStatus('error');
      }
      setTimeout(() => setSaveStatus((s) => (s === 'saved' || s === 'error' ? 'idle' : s)), 2000);
    },
    [sessionId]
  );

  // Debounced auto-save
  useEffect(() => {
    if (title === initialTitle) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(latestTitle.current);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Copy participant URL to clipboard
  const copyLink = useCallback(async (token: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié !', { description: url });
    } catch {
      toast.error('Impossible de copier le lien');
    }
  }, []);

  // Publish or copy
  const handleShare = useCallback(async () => {
    // If already published, just copy the link
    if (isPublished && sessionToken) {
      await copyLink(sessionToken);
      return;
    }

    setPublishStatus('publishing');
    setShowIssues(false);
    setValidationIssues([]);

    const result = await publishSessionAction(sessionId);

    setPublishStatus('idle');

    if (result.ok) {
      setSessionToken(result.token);
      await copyLink(result.token);
      toast.success('Session live — lien copié !');
    } else if ('validationIssues' in result) {
      setValidationIssues(result.validationIssues);
      setShowIssues(true);
    } else {
      toast.error(result.error ?? 'Erreur de publication');
    }
  }, [isPublished, sessionToken, sessionId, copyLink]);

  return (
    <header
      className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0 relative"
      style={{ height: 56 }}
    >
      {/* Back to project */}
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Retour au projet"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>

      {/* Editable title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== initialTitle && title.trim()) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            save(title);
          }
        }}
        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground focus:outline-none truncate"
        placeholder="Titre de la session"
        aria-label="Titre de la session"
        maxLength={200}
      />

      {/* Auto-save status */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 min-w-[60px]"
      >
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving…</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <Check className="h-3 w-3 text-success" />
            <span className="text-success">Saved</span>
          </>
        )}
        {saveStatus === 'error' && (
          <span className="text-destructive">Erreur</span>
        )}
      </div>

      {/* Gate settings button */}
      {onGatePanel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGatePanel(true)}
          className="shrink-0 gap-1.5"
          aria-label="Paramètres de la session"
          title="Paramètres (mot de passe, appareil, RGPD)"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {/* Preview button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onPreview}
        className="shrink-0 gap-1.5"
        aria-label="Prévisualiser la session"
      >
        <Eye className="h-4 w-4" />
        Prévisualiser
      </Button>

      {/* Share / Copy link button */}
      <Button
        variant={isPublished ? 'outline' : 'default'}
        size="sm"
        onClick={handleShare}
        disabled={publishStatus === 'publishing'}
        className="shrink-0 gap-1.5"
        aria-label={isPublished ? 'Copier le lien participant' : 'Publier et partager la session'}
      >
        {publishStatus === 'publishing' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPublished ? (
          <Copy className="h-4 w-4" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {publishStatus === 'publishing'
          ? 'Publication…'
          : isPublished
          ? 'Copier le lien'
          : 'Partager'}
      </Button>

      {/* Validation issues dropdown */}
      {showIssues && validationIssues.length > 0 && (
        <div className="absolute right-4 top-full mt-2 z-50 bg-background border border-border rounded-lg shadow-lg w-80">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Blocs à configurer
            </div>
            <button
              onClick={() => setShowIssues(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="p-2 space-y-1 max-h-60 overflow-y-auto">
            {validationIssues.map((issue, i) => (
              <li key={i} className="px-2 py-1.5 rounded-md text-xs">
                <span className="text-muted-foreground">{issue.pageTitle} · </span>
                <span className="font-medium text-foreground">{issue.blockLabel}</span>
                <span className="text-destructive"> — {issue.issue}</span>
              </li>
            ))}
          </ul>
          <p className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
            Configurez ces blocs avant de publier.
          </p>
        </div>
      )}
    </header>
  );
}
