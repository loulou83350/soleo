import { Sparkles, MoreHorizontal, X } from 'lucide-react';
import type { AIFollowupTurn } from '@/lib/db/schema';

interface Props {
  /** Original question of the open-text block */
  originalQuestion: string;
  /** Original participant answer to that question */
  originalAnswer: string;
  /** Follow-up turns in chronological order (turn 1 → N) */
  turns: AIFollowupTurn[];
}

/**
 * Renders the full conversation: original question → answer → AI relance →
 * answer → … in document order. Indented branches make it clear which turns
 * are AI-generated. Each AI question gets a screen-reader-only label.
 */
export function AIConversationThread({
  originalQuestion,
  originalAnswer,
  turns,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Original Q + A */}
      <ThreadItem role="question" text={originalQuestion} />
      <ThreadItem role="answer" text={originalAnswer} />

      {/* AI follow-up turns */}
      {turns.map((turn) => {
        const isSkipped = turn.status === 'skipped';
        const isError = turn.status === 'timeout' || turn.status === 'error';
        return (
          <div
            key={turn.id}
            className="ml-4 pl-4 border-l-2 border-purple-200 space-y-3"
          >
            <ThreadItem
              role="ai-question"
              text={turn.aiQuestion}
              meta={`Relance ${turn.turnNumber}`}
            />
            {isSkipped && (
              <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                <X className="h-3 w-3" aria-hidden="true" />
                Le participant a passé cette question.
              </p>
            )}
            {isError && (
              <p className="text-xs text-muted-foreground italic">
                La relance n'a pas abouti ({turn.status}).
              </p>
            )}
            {!isSkipped && !isError && turn.participantAnswer && (
              <ThreadItem role="answer" text={turn.participantAnswer} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThreadItem({
  role,
  text,
  meta,
}: {
  role: 'question' | 'answer' | 'ai-question';
  text: string;
  meta?: string;
}) {
  if (role === 'question') {
    return (
      <p className="text-sm font-medium text-foreground leading-snug">
        {text}
      </p>
    );
  }
  if (role === 'ai-question') {
    return (
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-700 mb-1">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">Question de relance générée par l'IA :</span>
          <span aria-hidden="true">{meta ?? 'Relance IA'}</span>
        </div>
        <p className="text-sm font-medium text-foreground leading-snug">
          {text}
        </p>
      </div>
    );
  }
  // role === 'answer'
  return (
    <div className="flex gap-2 text-sm text-foreground/80 leading-relaxed">
      <MoreHorizontal className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/** Compact "AI" badge for the responses list (Story 5.1 + 5.2 cards). */
export function AIBadge({ count }: { count?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded"
      title={
        count
          ? `${count} relance${count > 1 ? 's' : ''} IA`
          : 'Cette réponse a été approfondie par l\'IA'
      }
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
      <span>AI{typeof count === 'number' && count > 1 ? ` ·${count}` : ''}</span>
    </span>
  );
}
