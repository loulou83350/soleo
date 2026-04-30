'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { TrendingUp } from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statHighlight: {
      insertStatHighlight: () => ReturnType;
    };
  }
}

/**
 * Custom Tiptap node — a "stat highlight" block with a big number + label.
 * Used to make a key metric pop visually in the report.
 *
 * Markdown-bridge contract: serialized as
 *   <div data-block="stat">...</div>
 * The first line of content becomes the big number, subsequent text the
 * caption. Editable inline in the editor.
 */
export const StatHighlight = Node.create({
  name: 'statHighlight',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-block="stat"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block': 'stat' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StatHighlightView);
  },

  addCommands() {
    return {
      insertStatHighlight:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [{ type: 'text', text: '+12 NPS · 18 répondants' }],
            })
            .run();
        },
    };
  },
});

function StatHighlightView() {
  return (
    <NodeViewWrapper as="div" className="my-4">
      <div className="flex items-center gap-3 rounded-lg border border-foreground/15 bg-foreground/[0.04] px-4 py-3">
        <TrendingUp className="h-4 w-4 text-foreground/70 shrink-0" aria-hidden />
        <NodeViewContent className="flex-1 text-lg font-semibold text-foreground tabular-nums [&_p]:m-0" />
      </div>
    </NodeViewWrapper>
  );
}
