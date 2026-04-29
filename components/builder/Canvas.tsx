'use client';

import { useState } from 'react';
import {
  BookOpen, Flag, AlignLeft, AlignJustify, CheckSquare, BarChart2,
  Star, Gauge, LayoutGrid, Table2, Eye, Play, Type, Plus,
} from 'lucide-react';
import type { SessionBlock, SessionPageWithBlocks, BlockType } from '@/lib/db/schema';
import { BLOCK_LABELS } from '@/lib/domain/blocks';
import { BlockPalette } from './BlockPalette';
import { addBlockAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';

// ─── Block type icons ─────────────────────────────────────────────────────────

const BLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  content: Type,
  short_text: AlignLeft,
  long_text: AlignJustify,
  mcq: CheckSquare,
  likert: BarChart2,
  rating: Star,
  nps: Gauge,
  card_sort: LayoutGrid,
  matrix: Table2,
  first_impression: Eye,
  prototype_task: Play,
};

// ─── Block preview card ────────────────────────────────────────────────────────

function BlockCard({
  block,
  isSelected,
  onSelect,
}: {
  block: SessionBlock;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = block.config as Record<string, unknown>;
  const question = typeof config?.question === 'string' ? config.question : '';
  const blockType = block.blockType as BlockType;
  const label = BLOCK_LABELS[blockType] ?? block.blockType;
  const Icon = BLOCK_ICONS[block.blockType] ?? AlignLeft;
  const isContent = block.blockType === 'content';

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
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {label}
          </p>

          {/* Content block: show title + body preview */}
          {/* Question block: show question text */}
          {isContent ? null : question ? (
            <p className="text-sm text-foreground leading-snug">{question}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Question vide…</p>
          )}

          {/* Type-specific inline preview */}
          <BlockPreview block={block} />

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

function BlockPreview({ block }: { block: SessionBlock }) {
  const config = block.config as Record<string, unknown>;

  switch (block.blockType) {
    case 'content': {
      const title = typeof config.title === 'string' ? config.title : '';
      const body = typeof config.body === 'string' ? config.body : '';
      return (
        <div className="mt-1.5 space-y-0.5">
          {title ? (
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Titre vide…</p>
          )}
          {body ? (
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{body}</p>
          ) : null}
        </div>
      );
    }
    case 'mcq': {
      const options = Array.isArray(config.options) ? config.options.slice(0, 3) : [];
      if (options.length === 0) return null;
      return (
        <ul className="mt-1.5 space-y-0.5">
          {options.map((opt, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-3 w-3 rounded-full border border-muted-foreground/40 shrink-0" />
              {String(opt) || `Option ${i + 1}`}
            </li>
          ))}
          {Array.isArray(config.options) && config.options.length > 3 && (
            <li className="text-xs text-muted-foreground/60">+{config.options.length - 3} autres…</li>
          )}
        </ul>
      );
    }
    case 'likert': {
      const scale = Number(config.scale) || 5;
      return (
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: scale }).map((_, i) => (
            <div key={i} className="h-4 w-4 rounded border border-muted-foreground/30 bg-muted" />
          ))}
        </div>
      );
    }
    case 'rating': {
      const max = Number(config.max) || 5;
      return (
        <div className="mt-1.5 flex gap-0.5">
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} className="h-3 w-3 text-muted-foreground/40" />
          ))}
        </div>
      );
    }
    case 'nps': {
      return (
        <div className="mt-1.5 flex gap-0.5">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-4 w-4 flex items-center justify-center rounded border border-muted-foreground/20 text-[8px] text-muted-foreground">
              {i}
            </div>
          ))}
        </div>
      );
    }
    case 'card_sort': {
      const items = Array.isArray(config.items) ? config.items.slice(0, 3) : [];
      if (items.length === 0) return null;
      return (
        <div className="mt-1.5 flex gap-1 flex-wrap">
          {items.map((item, i) => {
            const card = item as Record<string, unknown>;
            return (
              <span key={i} className="px-2 py-0.5 text-[10px] border border-border rounded bg-muted text-muted-foreground">
                {String(card.label || `Carte ${i + 1}`)}
              </span>
            );
          })}
        </div>
      );
    }
    case 'matrix': {
      const rows = Array.isArray(config.rows) ? config.rows.length : 0;
      const cols = Array.isArray(config.columns) ? config.columns.length : 0;
      return (
        <p className="mt-1.5 text-xs text-muted-foreground">{rows} lignes × {cols} colonnes</p>
      );
    }
    case 'first_impression': {
      const duration = Number(config.duration ?? 5);
      return (
        <div className="mt-1.5 flex items-center gap-2">
          {config.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.imageUrl as string}
              alt=""
              className="h-8 w-12 object-cover rounded border border-border"
            />
          ) : (
            <div className="h-8 w-12 rounded border border-dashed border-border bg-muted flex items-center justify-center">
              <Eye className="h-3 w-3 text-muted-foreground/40" />
            </div>
          )}
          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-medium">
            {duration} s
          </span>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Special page content ──────────────────────────────────────────────────────

function IntroPageContent() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Page d'introduction</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Les participants verront cette page en premier. La configuration du texte d'accueil sera disponible dans Story 3.x.
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

// ─── Canvas ────────────────────────────────────────────────────────────────────

interface CanvasProps {
  sessionId: number;
  page: SessionPageWithBlocks | null;
  selectedBlockId: number | null;
  onSelectBlock: (blockId: number) => void;
  onBlockAdded: (pageId: number, block: SessionBlock) => void;
}

export function Canvas({ sessionId, page, selectedBlockId, onSelectBlock, onBlockAdded }: CanvasProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

  async function handleSelectBlockType(blockType: BlockType) {
    if (!page) return;
    setPaletteOpen(false);
    setAddingBlock(true);
    const result = await addBlockAction(sessionId, page.id, blockType);
    setAddingBlock(false);
    if (result.success && result.data) {
      onBlockAdded(page.id, result.data.block);
      onSelectBlock(result.data.block.id);
    }
  }

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Sélectionnez une page</p>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-muted/20 p-6 relative">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {page.pageType === 'intro' ? 'Introduction' : page.pageType === 'end' ? 'Fin' : page.title}
          </span>
          {page.pageType === 'question' && (
            <button
              onClick={() => setPaletteOpen(true)}
              disabled={addingBlock}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-background transition-colors disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingBlock ? 'Ajout…' : 'Ajouter un bloc'}
            </button>
          )}
        </div>

        {page.pageType === 'intro' && <IntroPageContent />}
        {page.pageType === 'end' && <EndPageContent />}

        {page.pageType === 'question' && (
          <>
            {page.blocks.length === 0 ? (
              <div
                className="border border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-foreground/30 hover:bg-background/60 transition-colors"
                onClick={() => setPaletteOpen(true)}
              >
                <Plus className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Cliquez pour ajouter votre premier bloc
                </p>
              </div>
            ) : (
              <>
                {page.blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    isSelected={block.id === selectedBlockId}
                    onSelect={() => onSelectBlock(block.id)}
                  />
                ))}
                {/* Add block at bottom */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setPaletteOpen(true)}
                    disabled={addingBlock}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {addingBlock ? 'Ajout…' : 'Ajouter un bloc'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* BlockPalette */}
      {paletteOpen && (
        <BlockPalette
          onSelect={handleSelectBlockType}
          onClose={() => setPaletteOpen(false)}
          isLoading={addingBlock}
        />
      )}
    </main>
  );
}
