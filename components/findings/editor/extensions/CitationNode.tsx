'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { CitationPill, type CitationSource } from '@/components/findings/CitationPill';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (responseId: number) => ReturnType;
    };
  }
}

/**
 * Tiptap inline node representing a citation to a participant response.
 * Stores the responseId as an attribute. Renders as a <CitationPill>
 * so the researcher sees it as a real chip while editing — same look
 * as the public viewer.
 *
 * Round-trip with markdown happens in the editor's bodyHtml ↔ markdown
 * bridge: \{r:42\} ↔ <span data-citation-id="42"></span>
 */
export const CitationNode = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true, // single-unit, can't be split
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      responseId: {
        default: null,
        parseHTML: (el) => {
          const v = (el as HTMLElement).getAttribute('data-citation-id');
          return v ? Number(v) : null;
        },
        renderHTML: (attrs) =>
          attrs.responseId == null
            ? {}
            : { 'data-citation-id': String(attrs.responseId) },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-citation-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'citation-token' }), ''];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationNodeView);
  },

  addCommands() {
    return {
      insertCitation:
        (responseId: number) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { responseId },
            })
            .insertContent(' ') // trailing space so cursor moves naturally
            .run();
        },
    };
  },
});

// ─── React renderer ──────────────────────────────────────────────────────────

interface CitationNodeAttrs {
  responseId: number | null;
}

/** Read from a window-attached registry seeded by the parent editor */
function getSourcesFromRegistry(): Map<number, CitationSource> {
  if (typeof window === 'undefined') return new Map();
  const registry = (window as unknown as { __soleoCitationSources?: Map<number, CitationSource> }).__soleoCitationSources;
  return registry ?? new Map();
}

function CitationNodeView({ node }: NodeViewProps) {
  const attrs = node.attrs as CitationNodeAttrs;
  const responseId = attrs.responseId;
  const sources = getSourcesFromRegistry();

  if (responseId == null) {
    return (
      <NodeViewWrapper as="span" className="inline-block align-baseline">
        <span className="text-xs text-muted-foreground">?</span>
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <CitationPill responseId={responseId} sources={sources} withParticipantLink={false} />
    </NodeViewWrapper>
  );
}
