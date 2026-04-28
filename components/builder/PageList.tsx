'use client';

import { FileText, BookOpen, Flag } from 'lucide-react';
import type { SessionPageWithBlocks } from '@/lib/db/schema';

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

interface PageListProps {
  pages: SessionPageWithBlocks[];
  activePageId: number | null;
  onSelectPage: (pageId: number) => void;
}

export function PageList({ pages, activePageId, onSelectPage }: PageListProps) {
  return (
    <aside
      className="border-r border-border bg-background flex flex-col overflow-y-auto shrink-0"
      style={{ width: 240 }}
      aria-label="Liste des pages"
    >
      <div className="px-3 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pages
        </p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const pageType = page.pageType as keyof typeof PAGE_TYPE_ICON;
          const Icon = PAGE_TYPE_ICON[pageType] ?? FileText;
          const isSpecial = page.pageType === 'intro' || page.pageType === 'end';

          return (
            <button
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors group ${
                isActive
                  ? 'bg-muted text-foreground font-medium border-l-2 border-foreground -ml-px pl-[9px]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
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
          );
        })}
      </nav>
    </aside>
  );
}
