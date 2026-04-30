'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BookOpen, CheckCircle, AlignLeft, AlignJustify, CheckSquare, BarChart2,
  Star, Gauge, LayoutGrid, Table2, Eye, Play, Type,
  Plus, GripVertical, Trash2,
} from 'lucide-react';
import { addBlockAction, deleteBlockAction, reorderBlocksAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';
import type { SessionBlock, BlockType } from '@/lib/db/schema';
import { BLOCK_LABELS, ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { BlockPalette } from './BlockPalette';

// ─── Icons ────────────────────────────────────────────────────────────────────

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

const ICON_COLORS: Record<string, string> = {
  welcome:          'bg-blue-50 text-blue-600',
  thank_you:        'bg-green-50 text-green-600',
  content:          'bg-muted text-muted-foreground',
  short_text:       'bg-violet-50 text-violet-600',
  long_text:        'bg-violet-50 text-violet-600',
  mcq:              'bg-amber-50 text-amber-600',
  likert:           'bg-sky-50 text-sky-600',
  rating:           'bg-yellow-50 text-yellow-500',
  nps:              'bg-orange-50 text-orange-600',
  card_sort:        'bg-pink-50 text-pink-600',
  matrix:           'bg-teal-50 text-teal-600',
  first_impression: 'bg-indigo-50 text-indigo-600',
  prototype_task:   'bg-rose-50 text-rose-600',
};

/** Returns the label text to show in the step list item */
function getStepPreview(block: SessionBlock): string {
  const cfg = block.config as Record<string, unknown>;
  switch (block.blockType) {
    case 'welcome':
    case 'thank_you':
      return typeof cfg.title === 'string' && cfg.title ? cfg.title : BLOCK_LABELS[block.blockType as BlockType];
    case 'content':
      return typeof cfg.title === 'string' && cfg.title ? cfg.title : 'Contenu';
    default:
      return typeof cfg.question === 'string' && cfg.question ? cfg.question : 'Question vide…';
  }
}

// ─── Sortable step item ───────────────────────────────────────────────────────

interface SortableStepItemProps {
  block: SessionBlock;
  index: number;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableStepItem({ block, index, isActive, isDeleting, onSelect, onDelete }: SortableStepItemProps) {
  const isAnchor = ANCHOR_BLOCK_TYPES.includes(block.blockType as BlockType);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: isAnchor,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = BLOCK_ICONS[block.blockType] ?? AlignLeft;
  const iconColor = ICON_COLORS[block.blockType] ?? 'bg-muted text-muted-foreground';
  const label = BLOCK_LABELS[block.blockType as BlockType] ?? block.blockType;
  const preview = getStepPreview(block);

  return (
    <div ref={setNodeRef} style={style} className="group/step relative">
      <button
        onClick={onSelect}
        aria-current={isActive ? 'step' : undefined}
        className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-md transition-colors ${
          isActive
            ? 'bg-muted text-foreground border-l-2 border-foreground -ml-px pl-[7px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`}
      >
        {/* Drag handle — only for non-anchor blocks */}
        {!isAnchor ? (
          <span
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground touch-none"
            aria-label="Réordonner"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="shrink-0 w-3.5" />
        )}

        {/* Colored icon */}
        <span className={`h-6 w-6 rounded flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>

        {/* Content */}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] text-muted-foreground/70 leading-none mb-0.5">
            {label}
          </span>
          <span className={`block text-xs truncate leading-tight ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
            {preview}
          </span>
        </span>

        {/* Step number for non-anchor blocks */}
        {!isAnchor && (
          <span className="text-[10px] tabular-nums text-muted-foreground/40 shrink-0">
            {index}
          </span>
        )}
      </button>

      {/* Delete button — only for non-anchor blocks */}
      {!isAnchor && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          disabled={isDeleting}
          aria-label={`Supprimer ${label}`}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/0 group-hover/step:text-muted-foreground/40 hover:!text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── StepList ─────────────────────────────────────────────────────────────────

interface StepListProps {
  sessionId: number;
  blocks: SessionBlock[];
  activeBlockId: number | null;
  onSelectBlock: (blockId: number) => void;
  onBlocksUpdated: (newBlocks: SessionBlock[]) => void;
  onBlockAdded: (block: SessionBlock) => void;
  onBlockDeleted: (blockId: number) => void;
}

export function StepList({
  sessionId,
  blocks,
  activeBlockId,
  onSelectBlock,
  onBlocksUpdated,
  onBlockAdded,
  onBlockDeleted,
}: StepListProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Only non-anchor blocks participate in drag-sort
  const draggableBlockIds = blocks
    .filter((b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as BlockType))
    .map((b) => b.id);

  // Question step count (excluding anchors) for numbering
  let questionIdx = 0;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Safety: never allow dragging before welcome (index 0) or after thank_you (last index)
    const welcomeIdx = blocks.findIndex((b) => b.blockType === 'welcome');
    const thankYouIdx = blocks.findIndex((b) => b.blockType === 'thank_you');
    const clampedIndex = Math.max(welcomeIdx + 1, Math.min(thankYouIdx - 1, newIndex));
    if (clampedIndex === oldIndex) return;

    const reordered = arrayMove(blocks, oldIndex, clampedIndex);
    onBlocksUpdated(reordered);
    await reorderBlocksAction(sessionId, reordered.map((b) => b.id));
  }

  const handleAddBlock = useCallback(async (blockType: BlockType) => {
    setPaletteOpen(false);
    setIsAdding(true);

    // Insert before the thank_you block
    const thankYouBlock = blocks.find((b) => b.blockType === 'thank_you');
    if (!thankYouBlock) { setIsAdding(false); return; }

    const result = await addBlockAction(sessionId, thankYouBlock.id, blockType);
    setIsAdding(false);

    if (result.success && result.data) {
      onBlockAdded(result.data.block);
      onSelectBlock(result.data.block.id);
    }
  }, [sessionId, blocks, onBlockAdded, onSelectBlock]);

  const handleDeleteBlock = useCallback(async (blockId: number) => {
    setDeletingBlockId(blockId);
    const result = await deleteBlockAction(sessionId, blockId);
    setDeletingBlockId(null);
    if (result.success) {
      onBlockDeleted(blockId);
    }
  }, [sessionId, onBlockDeleted]);

  return (
    <aside
      className="border-r border-border bg-background flex flex-col overflow-y-auto shrink-0"
      style={{ width: 240 }}
      aria-label="Liste des étapes"
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Étapes
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          {blocks.filter((b) => !ANCHOR_BLOCK_TYPES.includes(b.blockType as BlockType)).length}
        </span>
      </div>

      {/* Sortable step list */}
      <nav className="flex-1 p-2 space-y-0.5" aria-label="Étapes de la session">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={draggableBlockIds} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => {
              const isAnchor = ANCHOR_BLOCK_TYPES.includes(block.blockType as BlockType);
              if (!isAnchor) questionIdx++;
              return (
                <SortableStepItem
                  key={block.id}
                  block={block}
                  index={questionIdx}
                  isActive={block.id === activeBlockId}
                  isDeleting={deletingBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onDelete={() => handleDeleteBlock(block.id)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </nav>

      {/* Add step button */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={() => setPaletteOpen(true)}
          disabled={isAdding}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          {isAdding ? 'Ajout…' : 'Ajouter une étape'}
        </button>
      </div>

      {/* BlockPalette modal */}
      {paletteOpen && (
        <BlockPalette
          onSelect={handleAddBlock}
          onClose={() => setPaletteOpen(false)}
          isLoading={isAdding}
        />
      )}
    </aside>
  );
}
