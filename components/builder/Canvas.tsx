'use client';

import { BookOpen, Flag, MessageSquare } from 'lucide-react';
import type { SessionPageWithBlocks, SessionBlock } from '@/lib/db/schema';

// ─── Block preview card ────────────────────────────────────────────────────

const BLOCK_TYPE_LABEL: Record<string, string> = {
  open_text: 'Texte libre',
  mcq: 'Choix multiple',
  likert: 'Échelle de Likert',
  rating: 'Note (étoiles)',
  nps: 'NPS',
  ranking: 'Classement',
  matrix: 'Matrice',
  prototype_task: 'Tâche prototype',
};

function BlockCard({
  block,
  isSelected,
  onSelect,
}: {
  block: SessionBlock;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = block.config as Record<string, string>;
  const question = config?.question ?? '';
  const label = BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border rounded-lg p-4 transition-colors ${
        isSelected
          ? 'border-foreground/40 bg-muted/40 ring-1 ring-foreground/20'
          : 'border-border bg-background hover:border-foreground/20 hover:bg-muted/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {label}
          </p>
          {question ? (
            <p className="text-sm text-foreground leading-snug">{question}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Question vide…</p>
          )}
          {block.required && (
            <span className="mt-1.5 inline-block text-[10px] text-destructive font-medium">
              Obligatoire
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Special page content ──────────────────────────────────────────────────

function IntroPageContent() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Page d'introduction</p>
        <p className="text-xs text-muted-foreground mt-1">
          Les participants verront cette page en premier.
          La configuration du texte d'accueil sera disponible dans Story 2.3.
        </p>
      </div>
    </div>
  );
}

function EndPageContent() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <Flag className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Page de fin</p>
        <p className="text-xs text-muted-foreground mt-1">
          Les participants verront cette page après avoir complété la session.
        </p>
      </div>
    </div>
  );
}

// ─── Canvas ────────────────────────────────────────────────────────────────

interface CanvasProps {
  page: SessionPageWithBlocks | null;
  selectedBlockId: number | null;
  onSelectBlock: (blockId: number) => void;
}

export function Canvas({ page, selectedBlockId, onSelectBlock }: CanvasProps) {
  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Sélectionnez une page</p>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Page title chip */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {page.pageType === 'intro'
              ? 'Introduction'
              : page.pageType === 'end'
              ? 'Fin'
              : page.title}
          </span>
        </div>

        {page.pageType === 'intro' && <IntroPageContent />}
        {page.pageType === 'end' && <EndPageContent />}
        {page.pageType === 'question' && (
          <>
            {page.blocks.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Cette page n'a pas encore de blocs.
                </p>
              </div>
            ) : (
              page.blocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  isSelected={block.id === selectedBlockId}
                  onSelect={() => onSelectBlock(block.id)}
                />
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
