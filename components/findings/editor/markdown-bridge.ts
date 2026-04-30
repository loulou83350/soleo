/**
 * Tiny markdown ↔ HTML bridge for the Tiptap editor (Story 6.4).
 *
 * The DB still stores markdown in `session_findings.body_markdown` so that:
 *  - Existing findings keep working (Story 6.1 markdown editor compat)
 *  - The public viewer keeps reading markdown via MarkdownWithCitations
 *  - AI generation (which produces markdown) plugs in unchanged
 *
 * The bridge converts between:
 *  - Markdown with \{r:ID\} tokens  (DB format)
 *  - HTML with <span data-citation-id="ID"></span>  (Tiptap input/output)
 *
 * We avoid pulling in turndown / marked here — the markdown subset we
 * support is intentionally narrow (the same that the AI generates):
 *   # H1, ## H2, ### H3, paragraphs, **bold**, *italic*, `code`,
 *   - bullet list, 1. ordered list, > blockquote, --- HR
 */

const CITATION_TOKEN_RE = /\{r:(\d+)\}/g;
const CITATION_HTML_RE = /<span\s+data-citation-id="(\d+)"[^>]*>[^<]*<\/span>/g;

// ─── Markdown → HTML ─────────────────────────────────────────────────────────

/**
 * Minimal markdown → HTML converter for the subset used in findings.
 * Not a full markdown parser — covers what the AI generator produces.
 * Citation tokens become \<span data-citation-id="N"\>\</span\>.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return '';

  // 1. First pass: replace citation tokens with HTML spans (BEFORE escaping)
  let text = markdown.replace(CITATION_TOKEN_RE, (_m, id) =>
    `<span data-citation-id="${id}"></span>`
  );

  const lines = text.split('\n');
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inBlockquote = false;
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      out.push(`<p>${inlineFormat(paragraphBuffer.join(' '))}</p>`);
      paragraphBuffer = [];
    }
  }

  function closeList() {
    if (inList) {
      out.push(inList === 'ul' ? '</ul>' : '</ol>');
      inList = null;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Blank line — flush paragraph
    if (line.trim() === '') {
      flushParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    // Headings
    const h1 = line.match(/^#\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h1 || h2 || h3) {
      flushParagraph();
      closeList();
      closeBlockquote();
      const level = h3 ? 3 : h2 ? 2 : 1;
      const content = (h3?.[1] ?? h2?.[1] ?? h1?.[1]) || '';
      out.push(`<h${level}>${inlineFormat(content)}</h${level}>`);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      closeList();
      closeBlockquote();
      out.push('<hr />');
      continue;
    }

    // Blockquote
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        out.push('<blockquote>');
        inBlockquote = true;
      }
      out.push(`<p>${inlineFormat(bq[1])}</p>`);
      continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    // Bullet list
    const ul = line.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (inList !== 'ul') {
        closeList();
        out.push('<ul>');
        inList = 'ul';
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (inList !== 'ol') {
        closeList();
        out.push('<ol>');
        inList = 'ol';
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`);
      continue;
    }

    // Otherwise: paragraph line
    if (inList) closeList();
    paragraphBuffer.push(line);
  }
  flushParagraph();
  closeList();
  closeBlockquote();
  return out.join('\n');
}

/** Inline formatting: bold, italic, code, links. Citation HTML preserved. */
function inlineFormat(s: string): string {
  // Escape lone < > but preserve our citation spans (already valid HTML)
  // The simplest safe rule: only escape < that isn't followed by 'span data-citation-id'
  // To keep it small, we accept some HTML pass-through (input is from controlled markdown).

  return s
    // Bold: **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    // Inline code: `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Markdown links: [label](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ─── HTML → Markdown ─────────────────────────────────────────────────────────

/**
 * Tiptap → markdown serializer. Uses editor.getHTML() then converts back.
 * Walks the HTML and produces markdown matching what AI generates.
 */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';

  // Replace citation spans with markdown tokens BEFORE further processing
  let text = html.replace(CITATION_HTML_RE, (_m, id) => `{r:${id}}`);

  // Replace block elements with markdown
  text = text
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, (_m, c) => `\n# ${stripTags(c)}\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, (_m, c) => `\n## ${stripTags(c)}\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, (_m, c) => `\n### ${stripTags(c)}\n`)
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner) => {
      const innerMd = htmlToMarkdown(inner).trim();
      return innerMd
        .split('\n')
        .map((l) => (l.length > 0 ? `> ${l}` : '>'))
        .join('\n') + '\n';
    })
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
        (mm) => `- ${stripTags(mm[1]).trim()}`
      );
      return '\n' + items.join('\n') + '\n';
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(
        (mm, idx) => `${idx + 1}. ${stripTags(mm[1]).trim()}`
      );
      return '\n' + items.join('\n') + '\n';
    })
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, c) => `\n${formatInline(c)}\n`)
    .replace(/<br\s*\/?>/gi, '\n');

  // Inline formatting
  text = formatInline(text);

  // Clean up: collapse multiple blank lines, trim
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripTags(html: string): string {
  return formatInline(html);
}

function formatInline(s: string): string {
  return s
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, ''); // strip remaining tags (defensive)
}
