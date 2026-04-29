'use client';

import { useState, useCallback } from 'react';
import { BuilderHeader } from './BuilderHeader';
import { PageList } from './PageList';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import type { SessionWithPages, SessionPageWithBlocks, SessionPage } from '@/lib/db/schema';

interface BuilderClientProps {
  session: SessionWithPages;
  projectId: number;
}

export function BuilderClient({ session, projectId }: BuilderClientProps) {
  // Pages live in state so we can update them after addPage / reorderPages
  const [pages, setPages] = useState<SessionPageWithBlocks[]>(session.pages);

  const firstPage = pages[0] ?? null;
  const [activePageId, setActivePageId] = useState<number | null>(firstPage?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  function handleSelectPage(pageId: number) {
    setActivePageId(pageId);
    setSelectedBlockId(null);
  }

  /**
   * Called by PageList after a successful addPage server action.
   * `newPages` contains the DB-ordered list (without block details),
   * so we merge with existing block data to keep blocks in sync.
   */
  const handlePagesUpdated = useCallback(
    (newPages: SessionPage[]) => {
      setPages((prev) => {
        const blocksByPageId = new Map(prev.map((p) => [p.id, p.blocks]));
        return newPages.map((p) => ({
          ...p,
          blocks: blocksByPageId.get(p.id) ?? [],
        }));
      });

      // If the active page was removed, fall back to the first page
      setActivePageId((prev) => {
        const stillExists = newPages.some((p) => p.id === prev);
        return stillExists ? prev : (newPages[0]?.id ?? null);
      });
    },
    []
  );

  /**
   * Called by PageList when a new page is added, so we can select it.
   */
  const handlePageAdded = useCallback((newPageId: number) => {
    setActivePageId(newPageId);
    setSelectedBlockId(null);
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100dvh - 56px)' }}
    >
      {/* Builder header — 56px */}
      <BuilderHeader
        sessionId={session.id}
        projectId={projectId}
        initialTitle={session.title}
      />

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        <PageList
          sessionId={session.id}
          pages={pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
          onPagesUpdated={handlePagesUpdated}
          onPageAdded={handlePageAdded}
        />
        <Canvas
          page={activePage}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
        />
        <ConfigPanel page={activePage} selectedBlockId={selectedBlockId} />
      </div>
    </div>
  );
}
