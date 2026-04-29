'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  AlignJustify,
  CheckSquare,
  BarChart2,
  Star,
  Gauge,
  LayoutGrid,
  Table2,
  Eye,
  Play,
  Type,
  X,
} from 'lucide-react';
import type { BlockType } from '@/lib/db/schema';
import { BLOCK_LABELS, BLOCK_PALETTE_ORDER } from '@/lib/domain/blocks';

// ─── Icons per block type ─────────────────────────────────────────────────────

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
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

// ─── BlockPalette ─────────────────────────────────────────────────────────────

interface BlockPaletteProps {
  onSelect: (blockType: BlockType) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function BlockPalette({ onSelect, onClose, isLoading }: BlockPaletteProps) {
  const [focusIdx, setFocusIdx] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const activeTypes = BLOCK_PALETTE_ORDER.filter((t) => t !== 'prototype_task');
  const allTypes = BLOCK_PALETTE_ORDER;

  // Trap focus and handle keyboard
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, activeTypes.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 2, activeTypes.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 2, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const type = activeTypes[focusIdx];
        if (type) onSelect(type);
      }
    }

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [focusIdx, activeTypes, onClose, onSelect]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        aria-hidden
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Choisir un type de bloc"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-xl shadow-xl w-[480px] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">Ajouter un bloc</p>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-3 grid grid-cols-2 gap-1.5">
          {allTypes.map((blockType, idx) => {
            const isDisabled = blockType === 'prototype_task';
            const Icon = BLOCK_ICONS[blockType];
            const isFocused = !isDisabled && activeTypes[focusIdx] === blockType;

            return (
              <button
                key={blockType}
                disabled={isDisabled || isLoading}
                onClick={() => !isDisabled && onSelect(blockType)}
                onMouseEnter={() => {
                  if (!isDisabled) setFocusIdx(activeTypes.indexOf(blockType));
                }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isFocused
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }
                `}
                aria-disabled={isDisabled}
              >
                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">
                    {BLOCK_LABELS[blockType]}
                  </p>
                  {isDisabled && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Bientôt</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            ↑↓ naviguer · Entrée sélectionner · Échap fermer
          </p>
        </div>
      </div>
    </>
  );
}
