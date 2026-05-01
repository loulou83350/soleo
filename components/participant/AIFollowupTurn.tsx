'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  /** Streamed text — empty string while loading, then incremental */
  question: string;
  /** True while waiting for the first token (3s loading state) */
  isLoading: boolean;
  /** Disables submit/skip while a network operation is in flight */
  isSubmitting: boolean;
  /** Called on Enter (short answers) or click submit */
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  /** Reset the input when a new turn starts */
  resetKey: number;
}

/**
 * UI for an AI-generated follow-up question + the participant's answer field.
 * Shown immediately after submitting an answer to an AI-enabled open-text block.
 *
 * States:
 *  - isLoading=true  → show spinner + "L'IA prépare une question…"
 *  - isLoading=false → show the streaming question (typed-in feel) + textarea
 */
export function AIFollowupTurn({
  question,
  isLoading,
  isSubmitting,
  onSubmit,
  onSkip,
  resetKey,
}: Props) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset on new turn + autofocus once question is fully streamed
  useEffect(() => {
    setAnswer('');
  }, [resetKey]);

  useEffect(() => {
    if (!isLoading && question && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, question]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl+Enter submits — Enter creates a newline (matches LongTextBlock)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSubmitting) {
      e.preventDefault();
      onSubmit(answer);
    }
  }

  return (
    <div className="space-y-4">
      {/* AI label */}
      <div className="flex items-center gap-2 text-xs font-medium text-purple-700">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Question de relance générée par l'IA :</span>
        <span aria-hidden="true">Relance IA</span>
      </div>

      {/* Question (streaming text) */}
      <div
        aria-live="polite"
        className="text-xl font-semibold text-foreground leading-snug min-h-[2rem]"
      >
        {isLoading && !question ? (
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>L'IA prépare une question…</span>
          </span>
        ) : (
          <>
            {question}
            {/* blinking caret while still streaming */}
            {isLoading && (
              <span className="inline-block w-0.5 h-5 bg-foreground/60 ml-0.5 animate-pulse align-middle" />
            )}
          </>
        )}
      </div>

      {/* Answer */}
      <textarea
        ref={inputRef}
        className="w-full text-base border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-none transition-colors"
        rows={4}
        placeholder="Votre réponse…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || isSubmitting}
        aria-label="Réponse à la question de relance IA"
      />
      <p className="text-xs text-muted-foreground/70">
        <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded">⌘</kbd>
        {' + '}
        <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded">Entrée</kbd>{' '}
        pour valider
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={isSubmitting}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Passer cette question
        </button>
        <button
          type="button"
          onClick={() => onSubmit(answer)}
          disabled={isLoading || isSubmitting || answer.trim().length === 0}
          className="inline-flex items-center gap-1.5 bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Valider'
          )}
        </button>
      </div>
    </div>
  );
}
