'use client';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Fragment, type ReactNode } from 'react';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { CitationPill, type CitationSource } from './CitationPill';

interface Props {
  markdown: string;
  sources: Map<number, CitationSource>;
  withParticipantLink?: boolean;
}

const CITATION_RE = /\{r:(\d+)\}/g;

/**
 * Replaces every \{r:ID\} token inside a string with a <CitationPill>.
 * Used as a leaf transformer over text nodes.
 */
function renderTextWithCitations(
  text: string,
  sources: Map<number, CitationSource>,
  withParticipantLink: boolean
): ReactNode {
  if (!text.includes('{r:')) return text;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const id = Number(match[1]);
    parts.push(
      <CitationPill
        key={`cite-${match.index}-${id}`}
        responseId={id}
        sources={sources}
        withParticipantLink={withParticipantLink}
      />
    );
    lastIndex = CITATION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <Fragment>{parts}</Fragment>;
}

/**
 * Walks any React children, replacing string nodes with citation-aware fragments.
 */
function transformChildren(
  children: ReactNode,
  sources: Map<number, CitationSource>,
  withParticipantLink: boolean
): ReactNode {
  if (typeof children === 'string') {
    return renderTextWithCitations(children, sources, withParticipantLink);
  }
  if (Array.isArray(children)) {
    return children.map((c, idx) =>
      typeof c === 'string' ? (
        <Fragment key={idx}>
          {renderTextWithCitations(c, sources, withParticipantLink)}
        </Fragment>
      ) : (
        c
      )
    );
  }
  return children;
}

export function MarkdownWithCitations({
  markdown,
  sources,
  withParticipantLink = true,
}: Props) {
  return (
    <div className="prose prose-sm md:prose-base max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-h3:mt-6 prose-p:leading-relaxed prose-img:rounded-lg prose-img:border prose-img:border-border">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          p: ({ children }) => (
            <p>{transformChildren(children, sources, withParticipantLink)}</p>
          ),
          li: ({ children }) => (
            <li>{transformChildren(children, sources, withParticipantLink)}</li>
          ),
          strong: ({ children }) => (
            <strong>
              {transformChildren(children, sources, withParticipantLink)}
            </strong>
          ),
          em: ({ children }) => (
            <em>{transformChildren(children, sources, withParticipantLink)}</em>
          ),
          // Custom Soleo blocks rendered from raw HTML (rehype-raw)
          aside: ({ node, children, ...props }) => {
            const isInsight =
              (props as { 'data-block'?: string })['data-block'] === 'insight';
            if (!isInsight) return <aside {...props}>{children}</aside>;
            return (
              <aside className="not-prose my-4 flex items-start gap-3 rounded-lg border border-yellow-300/60 bg-yellow-50/40 px-4 py-3">
                <Lightbulb className="h-4 w-4 text-yellow-700 shrink-0 mt-1" aria-hidden />
                <div className="flex-1 text-foreground leading-relaxed">
                  {transformChildren(children, sources, withParticipantLink)}
                </div>
              </aside>
            );
          },
          div: ({ node, children, ...props }) => {
            const dataBlock = (props as { 'data-block'?: string })['data-block'];
            if (dataBlock === 'stat') {
              return (
                <div className="not-prose my-4 flex items-center gap-3 rounded-lg border border-foreground/15 bg-foreground/[0.04] px-4 py-3">
                  <TrendingUp className="h-4 w-4 text-foreground/70 shrink-0" aria-hidden />
                  <div className="flex-1 text-lg font-semibold text-foreground tabular-nums">
                    {transformChildren(children, sources, withParticipantLink)}
                  </div>
                </div>
              );
            }
            return <div {...props}>{children}</div>;
          },
        }}
      >
        {markdown || ''}
      </ReactMarkdown>
    </div>
  );
}
