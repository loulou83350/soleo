'use client';

import {
  BookOpen, CheckCircle, AlignLeft, AlignJustify, CheckSquare, BarChart2,
  Star, Gauge, LayoutGrid, Table2, Eye, Play, Type, GitBranch,
} from 'lucide-react';
import type { SessionBlock, BlockType } from '@/lib/db/schema';
import { BLOCK_LABELS } from '@/lib/domain/blocks';

// ─── Block type icons ─────────────────────────────────────────────────────────

const BLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  welcome:          BookOpen,
  thank_you:        CheckCircle,
  content:          Type,
  short_text:       AlignLeft,
  long_text:        AlignJustify,
  mcq:              CheckSquare,
  likert:           BarChart2,
  rating:           Star,
  nps:              Gauge,
  card_sort:        LayoutGrid,
  matrix:           Table2,
  first_impression: Eye,
  prototype_task:   Play,
};

// ─── Block preview card ────────────────────────────────────────────────────────

function BlockCard({
  block,
}: {
  block: SessionBlock;
}) {
  const config = block.config as Record<string, unknown>;
  const blockType = block.blockType as BlockType;
  const label = BLOCK_LABELS[blockType] ?? block.blockType;
  const Icon = BLOCK_ICONS[block.blockType] ?? AlignLeft;

  // Derive display title depending on type
  const title = (() => {
    switch (block.blockType) {
      case 'welcome':
      case 'thank_you':
        return typeof config.title === 'string' ? config.title : '';
      case 'content':
        return typeof config.title === 'string' ? config.title : '';
      default:
        return typeof config.question === 'string' ? config.question : '';
    }
  })();

  const isEmpty = !title;

  return (
    <div className="border border-foreground/20 bg-background rounded-xl p-6 ring-1 ring-foreground/10 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {label}
          </p>

          {/* Primary text */}
          {isEmpty ? (
            <p className="text-sm text-muted-foreground/50 italic">
              {block.blockType === 'content' ? 'Titre vide…' :
               block.blockType === 'welcome' || block.blockType === 'thank_you' ? 'Titre vide…' :
               'Question vide…'}
            </p>
          ) : (
            <p className="text-base font-medium text-foreground leading-snug">{title}</p>
          )}

          {/* Type-specific inline preview */}
          <BlockPreview block={block} />

          {/* Badges */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {block.required && (
              <span className="text-[10px] text-destructive font-medium">
                Obligatoire
              </span>
            )}
            {!!block.conditions && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                <GitBranch className="h-2.5 w-2.5" />
                Conditionnel
              </span>
            )}
            {(block.blockType === 'short_text' || block.blockType === 'long_text') &&
              (config as { aiFollowUp?: boolean }).aiFollowUp && (
                <span className="flex items-center gap-0.5 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
                  ✨ Relance IA
                  {typeof (config as { maxTurns?: number }).maxTurns === 'number' && (
                    <span className="text-purple-600">
                      &nbsp;·&nbsp;{(config as { maxTurns: number }).maxTurns}
                    </span>
                  )}
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: SessionBlock }) {
  const config = block.config as Record<string, unknown>;

  switch (block.blockType) {
    case 'welcome': {
      const description = typeof config.description === 'string' ? config.description : '';
      const buttonText  = typeof config.buttonText === 'string' ? config.buttonText : 'Commencer';
      return (
        <div className="mt-3 space-y-3">
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
          <div className="inline-flex items-center px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg">
            {buttonText}
          </div>
        </div>
      );
    }
    case 'thank_you': {
      const description = typeof config.description === 'string' ? config.description : '';
      return description ? (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      ) : null;
    }
    case 'content': {
      const body = typeof config.body === 'string' ? config.body : '';
      return body ? (
        <p className="mt-1.5 text-sm text-muted-foreground leading-snug line-clamp-3">{body}</p>
      ) : null;
    }
    case 'mcq': {
      const options = Array.isArray(config.options) ? config.options.slice(0, 4) : [];
      if (options.length === 0) return null;
      const allowMultiple = !!config.allowMultiple;
      return (
        <ul className="mt-3 space-y-1.5">
          {options.map((opt, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={`h-4 w-4 shrink-0 border border-muted-foreground/40 ${allowMultiple ? 'rounded' : 'rounded-full'}`} />
              {String(opt) || `Option ${i + 1}`}
            </li>
          ))}
          {Array.isArray(config.options) && config.options.length > 4 && (
            <li className="text-xs text-muted-foreground/50">+{config.options.length - 4} autres…</li>
          )}
        </ul>
      );
    }
    case 'likert': {
      const scale = Number(config.scale) || 5;
      const low   = typeof config.lowLabel === 'string' ? config.lowLabel : '';
      const high  = typeof config.highLabel === 'string' ? config.highLabel : '';
      return (
        <div className="mt-3">
          <div className="flex gap-1.5">
            {Array.from({ length: scale }).map((_, i) => (
              <div key={i} className="flex-1 h-8 rounded border border-muted-foreground/20 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                {i + 1}
              </div>
            ))}
          </div>
          {(low || high) && (
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground/70">{low}</span>
              <span className="text-[10px] text-muted-foreground/70">{high}</span>
            </div>
          )}
        </div>
      );
    }
    case 'rating': {
      const max = Number(config.max) || 5;
      return (
        <div className="mt-3 flex gap-1">
          {Array.from({ length: max }).map((_, i) => (
            <Star key={i} className="h-5 w-5 text-muted-foreground/30" />
          ))}
        </div>
      );
    }
    case 'nps': {
      const low  = typeof config.lowLabel === 'string' ? config.lowLabel : '';
      const high = typeof config.highLabel === 'string' ? config.highLabel : '';
      return (
        <div className="mt-3">
          <div className="flex gap-1">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="flex-1 h-8 flex items-center justify-center rounded border border-muted-foreground/20 text-xs text-muted-foreground">
                {i}
              </div>
            ))}
          </div>
          {(low || high) && (
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground/70">{low}</span>
              <span className="text-[10px] text-muted-foreground/70">{high}</span>
            </div>
          )}
        </div>
      );
    }
    case 'card_sort': {
      const items = Array.isArray(config.items) ? config.items.slice(0, 4) : [];
      if (items.length === 0) return null;
      return (
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {items.map((item, i) => {
            const card = item as Record<string, unknown>;
            return (
              <span key={i} className="px-2.5 py-1 text-xs border border-border rounded-md bg-muted text-muted-foreground">
                {String(card.label || `Carte ${i + 1}`)}
              </span>
            );
          })}
          {Array.isArray(config.items) && config.items.length > 4 && (
            <span className="text-xs text-muted-foreground/50">+{config.items.length - 4}…</span>
          )}
        </div>
      );
    }
    case 'matrix': {
      const rows = Array.isArray(config.rows) ? config.rows.length : 0;
      const cols = Array.isArray(config.columns) ? config.columns.length : 0;
      return (
        <p className="mt-2 text-sm text-muted-foreground">{rows} ligne{rows !== 1 ? 's' : ''} × {cols} colonne{cols !== 1 ? 's' : ''}</p>
      );
    }
    case 'first_impression': {
      const duration = Number(config.duration ?? 5);
      return (
        <div className="mt-3 flex items-center gap-3">
          {config.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.imageUrl as string}
              alt=""
              className="h-16 w-24 object-cover rounded-md border border-border"
            />
          ) : (
            <div className="h-16 w-24 rounded-md border border-dashed border-border bg-muted flex items-center justify-center">
              <Eye className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}
          <span className="text-xs px-2 py-1 bg-muted rounded font-medium text-muted-foreground">
            {duration} s
          </span>
        </div>
      );
    }
    case 'prototype_task': {
      const url = typeof config.url === 'string' ? config.url : '';
      let domain = '';
      try { domain = url ? new URL(url).hostname : ''; } catch { /* ignore */ }
      return (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded border border-border bg-muted flex items-center justify-center shrink-0">
            <Play className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          <span className="text-sm text-muted-foreground truncate">
            {domain || (url ? url : 'URL non définie')}
          </span>
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Canvas ────────────────────────────────────────────────────────────────────

interface CanvasProps {
  block: SessionBlock | null;
  onSelectBlock: (blockId: number) => void;
}

export function Canvas({ block, onSelectBlock }: CanvasProps) {
  if (!block) {
    return (
      <main className="flex-1 flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">Sélectionnez une étape</p>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-muted/20 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => onSelectBlock(block.id)}
          className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xl"
          aria-label={`Configurer ce bloc`}
        >
          <BlockCard block={block} />
        </button>
      </div>
    </main>
  );
}
