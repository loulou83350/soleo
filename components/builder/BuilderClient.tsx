'use client';

import { useState } from 'react';
import { BuilderHeader } from './BuilderHeader';
import { PageList } from './PageList';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import type { SessionWithPages } from '@/lib/db/schema';

interface BuilderClientProps {
  session: SessionWithPages;
  projectId: number;
}

export function BuilderClient({ session, projectId }: BuilderClientProps) {
  const firstPage = session.pages[0] ?? null;
  const [activePageId, setActivePageId] = useState<number | null>(firstPage?.id ?? null);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  const activePage = session.pages.find((p) => p.id === activePageId) ?? null;

  function handleSelectPage(pageId: number) {
    setActivePageId(pageId);
    setSelectedBlockId(null); // deselect block when switching page
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100dvh - 56px)' }} // 56px = global header from (dashboard)/layout
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
          pages={session.pages}
          activePageId={activePageId}
          onSelectPage={handleSelectPage}
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
