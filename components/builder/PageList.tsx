'use client';

import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, BookOpen, Flag, Plus, GripVertical } from 'lucide-react';
import { addPageAction, reorderPagesAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';
import type { SessionPage } from '@/lib/db/schema';
import type { SessionPageWithBlocks } from '@/lib/db/schema';

// ─── Icons & labels ──────────────────────────────────────────────────────────

const PAGE_TYPE_ICON = {
  intro: BookOpen,
  question: FileText,
  end: Flag,
} as const;

const PAGE_TYPE_LABEL = {
  intro: 'Introduction',
  question: 'Page',
  end: 'Fin',
} as const;

// ─── Sortable page item ───────────────────────────────────────────────────────

interface SortablePageItemProps {
  page: SessionPageWithBlocks;
  index: number;
  isActive: boolean;
  onSelect: () => void;
}

function SortablePageItem({ page, index, isActive, onSelect }: SortablePageItemProps) {
  const isSpecial = page.pageType === 'intro' || page.pageType === 'end';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    disabled: isSpecial, // intro and end pages cannot be dragged
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const pageType = page.pageType as keyof typeof PAGE_TYPE_ICON;
  const Icon = PAGE_TYPE_ICON[pageType] ?? FileText;

  return (
    <div ref={setNodeRef} style={style}>
      <button
        onClick={onSelect}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors group ${
          isActive
            ? 'bg-muted text-foreground font-medium border-l-2 border-foreground -ml-px pl-[7px]'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        }`}
      >
        {/* Drag handle — only for question pages */}
        {!isSpecial ? (
          <span
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
            aria-label="Réordonner"
            tabIndex={-1}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="shrink-0 w-3.5" />
        )}

        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
        />

        <span className="truncate flex-1">
          {isSpecial
            ? PAGE_TYPE_LABEL[pageType]
            : page.title || `Page ${index}`}
        </span>

        <span className="text-[10px] tabular-nums text-muted-foreground/60 shrink-0">
          {page.blocks.length}
        </span>
      </button>
    </div>
  );
}

// ─── PageList ─────────────────────────────────────────────────────────────────

interface PageListProps {
  sessionId: number;
  pages: SessionPageWithBlocks[];
  activePageId: number | null;
  onSelectPage: (pageId: number) => void;
  onPagesUpdated: (newPages: SessionPage[]) => void;
  onPageAdded: (newPageId: number) => void;
}

export function PageList({
  sessionId,
  pages,
  activePageId,
  onSelectPage,
  onPagesUpdated,
  onPageAdded,
}: PageListProps) {
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }, // require 4px drag to start
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Only question pages participate in drag sorting
  const questionPageIds = pages
    .filter((p) => p.pageType === 'question')
    .map((p) => p.id);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Compute new order: reorder question pages around intro/end
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pages, oldIndex, newIndex);
    // Optimistic update
    onPagesUpdated(reordered);

    // Persist
    const orderedPageIds = reordered.map((p) => p.id);
    await reorderPagesAction(sessionId, orderedPageIds);
  }

  const handleAddPage = useCallback(async () => {
    // Insert after the last question page (before the end page)
    const lastQuestionPage = [...pages]
      .reverse()
      .find((p) => p.pageType === 'question');
    const afterPageId = lastQuestionPage?.id ?? pages[0]?.id;
    if (!afterPageId) return;

    setIsAdding(true);
    const result = await addPageAction(sessionId, afterPageId);
    setIsAdding(false);

    if (result.success && result.data) {
      onPagesUpdated(result.data.pages);
      // The new page is the last question page in the returned list
      const newPage = [...result.data.pages]
        .reverse()
        .find((p) => p.pageType === 'question');
      if (newPage) onPageAdded(newPage.id);
    }
  }, [sessionId, pages, onPagesUpdated, onPageAdded]);

  return (
    <aside
      className="border-r border-border bg-background flex flex-col overflow-y-auto shrink-0"
      style={{ width: 240 }}
      aria-label="Liste des pages"
    >
      {/* Header */}
      <div className="px-3 py-3 border-b border-border flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pages
        </p>
        <button
          onClick={handleAddPage}
          disabled={isAdding}
          aria-label="Ajouter une page"
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sortable page list */}
      <nav className="flex-1 p-2 space-y-0.5" aria-label="Pages de la session">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={questionPageIds} strategy={verticalListSortingStrategy}>
            {pages.map((page, index) => (
              <SortablePageItem
                key={page.id}
                page={page}
                index={index + 1}
                isActive={page.id === activePageId}
                onSelect={() => onSelectPage(page.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </nav>
    </aside>
  );
}
