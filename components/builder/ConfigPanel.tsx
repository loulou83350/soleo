'use client';

import type { SessionBlock, SessionPageWithBlocks } from '@/lib/db/schema';

const BLOCK_TYPE_LABEL: Record<string, string> = {
  open_text: 'Texte libre',
  mcq: 'Choix multiple',
  likert: 'Échelle de Likert',
  rating: 'Note (étoiles)',
  nps: 'NPS',
  ranking: 'Classement',
  matrix: 'Matrice',
  prototype_task: 'Tâche prototype',
};

interface ConfigPanelProps {
  page: SessionPageWithBlocks | null;
  selectedBlockId: number | null;
}

function BlockConfigPlaceholder({ block }: { block: SessionBlock }) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          {BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}
        </p>
        <div className="space-y-3">
          <div className="p-3 rounded-md bg-muted/60 border border-border">
            <p className="text-xs text-muted-foreground">
              La configuration complète des blocs sera disponible dans Story 2.3.
            </p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">Type :</span>{' '}
              {BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}
            </p>
            <p>
              <span className="font-medium text-foreground">ID :</span> {block.id}
            </p>
            <p>
              <span className="font-medium text-foreground">Position :</span>{' '}
              {block.position}
            </p>
            <p>
              <span className="font-medium text-foreground">Obligatoire :</span>{' '}
              {block.required ? 'Oui' : 'Non'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfigPanel({ page, selectedBlockId }: ConfigPanelProps) {
  const selectedBlock =
    selectedBlockId != null
      ? page?.blocks.find((b) => b.id === selectedBlockId) ?? null
      : null;

  return (
    <aside
      className="border-l border-border bg-background overflow-y-auto shrink-0"
      style={{ width: 320 }}
      aria-label="Panneau de configuration"
    >
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configuration
        </p>
      </div>

      {selectedBlock ? (
        <BlockConfigPlaceholder block={selectedBlock} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez un bloc dans le canvas pour le configurer.
          </p>
        </div>
      )}
    </aside>
  );
}
