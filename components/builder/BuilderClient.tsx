'use client';

import { useState, useCallback } from 'react';
import { BuilderHeader } from './BuilderHeader';
import { PageList } from './PageList';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import type { SessionWithPages, SessionPageWithBlocks, SessionPage, SessionBlock } from '@/lib/db/schema';

interface BuilderClientProps {
  session: SessionWithPages;
  projectId: number;
}

export function BuilderClient({ session, projectId }: BuilderClientProps) {
  // Pages live in state so we can update them after add/reorder/block changes
  const [pages, setPages] = useState<SessionPageWithBlocks[]>(session.pages);

  const firstPage = pages[0] ?? null;
  const [activePageId, setActivePageId] = useState<number | null>(firstPage?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  // ─── Page callbacks ────────────────────────────────────────────────────────

  function handleSelectPage(pageId: number) {
    setActivePageId(pageId);
    setSelectedBlockId(null);
  }

  const handlePagesUpdated = useCallback((newPages: SessionPage[]) => {
    setPages((prev) => {
      const blocksByPageId = new Map(prev.map((p) => [p.id, p.blocks]));
      return newPages.map((p) => ({
        ...p,
        blocks: blocksByPageId.get(p.id) ?? [],
      }));
    });
    setActivePageId((prev) => {
      const stillExists = newPages.some((p) => p.id === prev);
      return stillExists ? prev : (newPages[0]?.id ?? null);
    });
  }, []);

  const handlePageAdded = useCallback((newPageId: number) => {
    setActivePageId(newPageId);
    setSelectedBlockId(null);
  }, []);

  // ─── Block callbacks ───────────────────────────────────────────────────────

  const handleBlockAdded = useCallback((pageId: number, block: SessionBlock) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId ? { ...p, blocks: [...p.blocks, block] } : p
      )
    );
  }, []);

  const handleBlockUpdated = useCallback(
    (blockId: number, updates: { config?: Record<string, unknown>; required?: boolean }) => {
      setPages((prev) =>
        prev.map((p) => ({
          ...p,
          blocks: p.blocks.map((b) =>
            b.id === blockId ? { ...b, ...updates } : b
          ),
        }))
      );
    },
    []
  );

  const handleBlockDeleted = useCallback((blockId: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        blocks: p.blocks.filter((b) => b.id !== blockId),
      }))
    );
    setSelectedBlockId((prev) => (prev === blockId ? null : prev));
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
          sessionId={session.id}
          page={activePage}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onBlockAdded={handleBlockAdded}
        />
        <ConfigPanel
          page={activePage}
          selectedBlockId={selectedBlockId}
          sessionId={session.id}
          onBlockDeleted={handleBlockDeleted}
          onBlockUpdated={handleBlockUpdated}
        />
      </div>
    </div>
  );
}
