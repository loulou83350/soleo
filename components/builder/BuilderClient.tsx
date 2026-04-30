'use client';

import { useState, useCallback } from 'react';
import { BuilderHeader } from './BuilderHeader';
import { StepList } from './StepList';
import { Canvas } from './Canvas';
import { ConfigPanel } from './ConfigPanel';
import { GatePanel } from './GatePanel';
import { PreviewModal } from './PreviewModal';
import type { SessionWithBlocks, SessionBlock } from '@/lib/db/schema';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import type { BlockType } from '@/lib/db/schema';

interface BuilderClientProps {
  session: SessionWithBlocks;
  projectId: number;
}

export function BuilderClient({ session, projectId }: BuilderClientProps) {
  // Flat blocks list — source of truth for all UI
  const [blocks, setBlocks] = useState<SessionBlock[]>(session.blocks);

  // Active block = the one shown in canvas + config panel
  const [activeBlockId, setActiveBlockId] = useState<number | null>(
    session.blocks[0]?.id ?? null
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [gatePanelOpen, setGatePanelOpen] = useState(false);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;

  /**
   * Blocs précédant le bloc actif (pour le sélecteur de conditions logiques).
   * = tous les blocs non-anchor, non-content situés avant activeBlockId.
   */
  const precedingBlocks = (() => {
    if (!activeBlockId) return [];
    const result: SessionBlock[] = [];
    for (const b of blocks) {
      if (b.id === activeBlockId) break;
      if (
        !ANCHOR_BLOCK_TYPES.includes(b.blockType as BlockType) &&
        b.blockType !== 'content'
      ) {
        result.push(b);
      }
    }
    return result;
  })();

  // ─── Block callbacks ───────────────────────────────────────────────────────

  /** Called by StepList after drag-and-drop reorder */
  const handleBlocksReordered = useCallback((newBlocks: SessionBlock[]) => {
    setBlocks(newBlocks);
  }, []);

  /** Called by StepList after a new block is inserted */
  const handleBlockAdded = useCallback((block: SessionBlock) => {
    setBlocks((prev) => {
      // Insert before thank_you (last block)
      const lastIdx = prev.length - 1;
      const copy = [...prev];
      copy.splice(lastIdx, 0, block);
      return copy;
    });
  }, []);

  /** Called by StepList after a block is deleted */
  const handleBlockDeleted = useCallback((blockId: number) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    setActiveBlockId((prev) => {
      if (prev !== blockId) return prev;
      // Fall back to first block
      const remaining = blocks.filter((b) => b.id !== blockId);
      return remaining[0]?.id ?? null;
    });
  }, [blocks]);

  /** Called by ConfigPanel on auto-save — updates local state for live preview */
  const handleBlockUpdated = useCallback(
    (blockId: number, updates: { config?: Record<string, unknown>; required?: boolean; conditions?: import('@/lib/domain/types').BlockVisibilityRule }) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
      );
    },
    []
  );

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
        initialStatus={session.status}
        initialToken={session.sessionToken ?? null}
        onPreview={() => setPreviewOpen(true)}
        onGatePanel={setGatePanelOpen}
      />

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: step list */}
        <StepList
          sessionId={session.id}
          blocks={blocks}
          activeBlockId={activeBlockId}
          onSelectBlock={setActiveBlockId}
          onBlocksUpdated={handleBlocksReordered}
          onBlockAdded={handleBlockAdded}
          onBlockDeleted={handleBlockDeleted}
        />

        {/* Centre: single-block canvas */}
        <Canvas
          block={activeBlock}
          onSelectBlock={setActiveBlockId}
        />

        {/* Right: config panel */}
        <ConfigPanel
          blocks={blocks}
          selectedBlockId={activeBlockId}
          sessionId={session.id}
          precedingBlocks={precedingBlocks}
          onBlockDeleted={handleBlockDeleted}
          onBlockUpdated={handleBlockUpdated}
        />
      </div>

      {/* Gate settings panel — slides over right panel */}
      {gatePanelOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white border-l border-border shadow-xl flex flex-col">
          <GatePanel
            sessionId={session.id}
            initial={{
              passwordEnabled: !!session.passwordHash,
              deviceRestriction: (session.deviceRestriction as 'any' | 'desktop' | 'mobile') ?? 'any',
              gdprEnabled: session.gdprEnabled ?? false,
              gdprMessage: session.gdprMessage ?? '',
            }}
            onClose={() => setGatePanelOpen(false)}
          />
        </div>
      )}

      {previewOpen && (
        <PreviewModal
          session={{ ...session, blocks }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
