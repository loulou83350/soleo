import { Quote } from 'lucide-react';

export interface HighlightDisplay {
  /** highlight row id */
  id: number;
  /** Sequential participant number for the session, e.g. 3 → "Participant #3" */
  participantNumber: number;
  /** The block question label */
  question: string;
  /** The response text, formatted */
  text: string;
  /** Optional researcher comment */
  customNote?: string | null;
}

interface Props {
  highlight: HighlightDisplay;
}

export function HighlightCard({ highlight }: Props) {
  if (!highlight.text.trim()) return null;
  return (
    <figure className="border-l-4 border-yellow-300 bg-yellow-50/40 rounded-r-lg p-5 space-y-2">
      <Quote className="h-4 w-4 text-yellow-600/70" aria-hidden />
      <blockquote className="text-foreground text-base leading-relaxed whitespace-pre-wrap font-medium">
        « {highlight.text} »
      </blockquote>
      <figcaption className="text-xs text-muted-foreground">
        — Participant #{highlight.participantNumber} · {highlight.question}
      </figcaption>
      {highlight.customNote && (
        <p className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-yellow-200/50">
          {highlight.customNote}
        </p>
      )}
    </figure>
  );
}
