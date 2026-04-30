'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export interface CitationSource {
  responseId: number;
  /** Sequential participant number for this session, e.g. 3 → "[#3]" */
  participantNumber: number;
  /** The participant's CUID2 token, used for the "View participant" link in the editor */
  participantToken?: string;
  /** Block question (label) */
  question: string;
  /** Stringified response value, formatted */
  text: string;
  /** Project + session ids — needed to build the "Voir participant" link */
  projectId?: number;
  sessionId?: number;
}

interface CitationPillProps {
  responseId: number;
  /** Lookup map: responseId → CitationSource. If missing, render a greyed-out [?]. */
  sources: Map<number, CitationSource>;
  /** When false (public viewer), the "Voir participant" link is hidden */
  withParticipantLink?: boolean;
}

export function CitationPill({
  responseId,
  sources,
  withParticipantLink = true,
}: CitationPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const source = sources.get(responseId);

  if (!source) {
    // Hallucination or stale citation
    return (
      <span className="inline-flex items-center align-baseline mx-0.5 text-xs px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground/60 cursor-not-allowed">
        ?
      </span>
    );
  }

  const truncated =
    source.text.length > 240 ? source.text.slice(0, 240) + '…' : source.text;

  return (
    <span ref={ref} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center mx-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors tabular-nums"
        aria-label={`Source : participant ${source.participantNumber}`}
      >
        #{source.participantNumber}
      </button>

      {open && (
        <span className="absolute z-20 left-0 top-full mt-1 w-80 max-w-[90vw]">
          <span className="block bg-background border border-border rounded-lg shadow-lg p-3 space-y-2 text-left">
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
              Participant #{source.participantNumber}
            </span>
            <span className="block text-xs font-medium text-foreground">
              {source.question}
            </span>
            <span className="block text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {truncated || <em className="text-muted-foreground">(réponse vide)</em>}
            </span>
            {withParticipantLink &&
              source.participantToken &&
              source.projectId &&
              source.sessionId && (
                <Link
                  href={`/dashboard/projects/${source.projectId}/sessions/${source.sessionId}/participants/${source.participantToken}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voir le participant
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
          </span>
        </span>
      )}
    </span>
  );
}
