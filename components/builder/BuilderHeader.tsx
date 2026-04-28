'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Share2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateSessionTitleAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface BuilderHeaderProps {
  sessionId: number;
  projectId: number;
  initialTitle: string;
}

export function BuilderHeader({ sessionId, projectId, initialTitle }: BuilderHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);

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
      // Reset to idle after 2s
      setTimeout(() => setSaveStatus((s) => (s === 'saved' || s === 'error' ? 'idle' : s)), 2000);
    },
    [sessionId]
  );

  // Debounced auto-save: triggers 2s after last keystroke
  useEffect(() => {
    if (title === initialTitle) return; // no change
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(latestTitle.current);
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  return (
    <header
      className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0"
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
          // Also save on blur (in case debounce hasn't fired yet)
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

      {/* Share button (placeholder for Story 2.4) */}
      <Button variant="outline" size="sm" disabled className="shrink-0 gap-1.5">
        <Share2 className="h-4 w-4" />
        Partager
      </Button>
    </header>
  );
}
