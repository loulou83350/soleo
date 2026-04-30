'use client';

import { useState, useTransition } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import {
  pinHighlightAction,
  unpinHighlightAction,
} from '@/app/(dashboard)/dashboard/projects/[id]/sessions/[sessionId]/participants/[participantToken]/actions';

interface Props {
  responseId: number;
  initialPinned: boolean;
}

export function PinHighlightButton({ responseId, initialPinned }: Props) {
  const [pinned, setPinned] = useState(initialPinned);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !pinned;
    setPinned(next); // optimistic
    startTransition(async () => {
      const res = next
        ? await pinHighlightAction(responseId)
        : await unpinHighlightAction(responseId);
      if (!res.success) setPinned(!next); // rollback
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      title={
        pinned
          ? 'Retirer cette réponse du rapport'
          : 'Épingler cette réponse dans le rapport'
      }
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
        pinned
          ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
          : 'border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
      }`}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : pinned ? (
        <BookmarkCheck className="h-3 w-3" />
      ) : (
        <Bookmark className="h-3 w-3" />
      )}
      {pinned ? 'Épinglée' : 'Épingler dans le rapport'}
    </button>
  );
}
