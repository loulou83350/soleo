'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Lightbulb } from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insightCallout: {
      insertInsightCallout: () => ReturnType;
    };
  }
}

/**
 * Custom Tiptap node — an editorial callout box for highlighting key
 * insights in the report. Renders as a bordered, lightly-tinted block
 * with a lightbulb icon. Content is editable as a single paragraph.
 *
 * Markdown-bridge contract: serialized as
 *   <aside data-block="insight"> ...content... </aside>
 * which the bridge preserves verbatim in markdown (raw HTML), and the
 * public viewer renders via rehype-raw + custom component.
 */
export const InsightCallout = Node.create({
  name: 'insightCallout',
  group: 'block',
  // Allow inline content (text, bold, italic, citations, etc.)
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'aside[data-block="insight"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, { 'data-block': 'insight' }),
      0, // 0 = content hole
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InsightCalloutView);
  },

  addCommands() {
    return {
      insertInsightCallout:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              content: [{ type: 'text', text: 'Constat clé : ' }],
            })
            .run();
        },
    };
  },
});

function InsightCalloutView() {
  return (
    <NodeViewWrapper as="aside" className="my-4">
      <div className="flex items-start gap-3 rounded-lg border border-yellow-300/60 bg-yellow-50/40 px-4 py-3">
        <Lightbulb className="h-4 w-4 text-yellow-700 shrink-0 mt-1" aria-hidden />
        <NodeViewContent className="flex-1 text-foreground leading-relaxed [&_p]:m-0" />
      </div>
    </NodeViewWrapper>
  );
}
