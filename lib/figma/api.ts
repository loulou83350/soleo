// ─── Figma REST API helpers ───────────────────────────────────────────────────
// Requires FIGMA_ACCESS_TOKEN env var (personal access token from figma.com/settings)

export interface FigmaFrame {
  id: string;
  name: string;
  /** Optional thumbnail URL (only populated when images are fetched separately) */
  thumbnailUrl?: string;
}

// ─── URL parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a Figma prototype or design URL into its constituent parts.
 * Handles both:
 *   https://www.figma.com/proto/{fileKey}/{name}?node-id=...&page-id=...
 *   https://www.figma.com/design/{fileKey}/{name}?node-id=...
 */
export function parseFigmaProtoUrl(url: string): {
  fileKey: string;
  pageId?: string;
  nodeId?: string;
} | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.includes('figma.com')) return null;

    const parts = u.pathname.split('/').filter(Boolean);
    // parts[0] = 'proto' | 'design', parts[1] = fileKey
    const fileKey = parts[1];
    if (!fileKey) return null;

    const rawNodeId = u.searchParams.get('node-id') ?? undefined;
    const rawPageId = u.searchParams.get('page-id') ?? undefined;

    // Normalize node IDs from URL format (2659-89089) to Figma format (2659:89089)
    const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ':') : undefined;
    const pageId = rawPageId ? rawPageId.replace(/-/g, ':') : undefined;

    return { fileKey, pageId, nodeId };
  } catch {
    return null;
  }
}

/**
 * Build a Figma embed URL from a proto/design URL.
 * Uses embed.figma.com subdomain and strips stale session params (t=, p=, scaling=…)
 * that cause Figma to return 500 inside iframes.
 */
export function toFigmaEmbedUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('figma.com')) return url;
    if (!u.pathname.startsWith('/proto/') && !u.pathname.startsWith('/design/')) return url;

    const embed = new URL(`https://embed.figma.com${u.pathname}`);
    const nodeId  = u.searchParams.get('node-id');
    const pageId  = u.searchParams.get('page-id');
    const startId = u.searchParams.get('starting-point-node-id');
    if (nodeId)  embed.searchParams.set('node-id', nodeId);
    if (pageId)  embed.searchParams.set('page-id', pageId);
    if (startId) embed.searchParams.set('starting-point-node-id', startId);

    // Embed API client-id — enables postMessage events (PRESENTED_NODE_CHANGED, etc.)
    // Origin must be whitelisted in figma.com → app → Embed API → Allowed embed origins.
    const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID;
    if (clientId) embed.searchParams.set('client-id', clientId);
    embed.searchParams.set('embed-host', 'share');
    return embed.toString();
  } catch {
    return url;
  }
}

// ─── Figma REST API ───────────────────────────────────────────────────────────

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaFile {
  document: FigmaNode;
}

/**
 * Fetch all top-level frames from a Figma file.
 * If pageId is provided, only frames from that page are returned.
 * If tokenOverride is provided, it's used instead of FIGMA_ACCESS_TOKEN env var.
 */
export async function fetchFigmaFrames(
  fileKey: string,
  pageId?: string,
  tokenOverride?: string
): Promise<FigmaFrame[]> {
  const token = tokenOverride ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('FIGMA_ACCESS_TOKEN non configuré. Ajoutez-le dans votre .env.local');
  }

  // depth=3 so SECTION children (frames inside sections) are included in the response
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=3`, {
    headers: { 'X-Figma-Token': token },
    // Don't cache — we want fresh data
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 403 || res.status === 401) {
      throw new Error('Token Figma invalide ou accès refusé à ce fichier');
    }
    if (res.status === 404) {
      throw new Error('Fichier Figma introuvable. Vérifiez que le lien est correct et que le fichier est accessible');
    }
    throw new Error(`Erreur Figma API (${res.status}): ${body.slice(0, 100)}`);
  }

  const data = (await res.json()) as FigmaFile;
  const document = data.document;

  // document.children = pages (CANVAS nodes)
  const pages = document.children ?? [];

  let targetPages = pages;
  if (pageId) {
    // Filter to the specific page
    const normalizedPageId = pageId.replace(/-/g, ':');
    targetPages = pages.filter((p) => p.id === normalizedPageId || p.id === pageId);
  }

  const frames: FigmaFrame[] = [];
  for (const page of targetPages) {
    for (const child of page.children ?? []) {
      collectFrames(child, frames);
    }
  }

  return frames;
}

/**
 * Recursively walk a node tree to collect FRAME and COMPONENT nodes.
 * SECTION nodes are NOT pushed (they're folders, not screens) but their children are walked.
 * Frame names are prefixed with parent section name for clarity: "Onboarding / Welcome".
 */
function collectFrames(node: FigmaNode, frames: FigmaFrame[], prefix = ''): void {
  if (node.type === 'FRAME' || node.type === 'COMPONENT') {
    frames.push({
      id: node.id,
      name: prefix ? `${prefix} / ${node.name}` : node.name,
    });
    return; // do not recurse into frames
  }
  if (node.type === 'SECTION') {
    const childPrefix = prefix ? `${prefix} / ${node.name}` : node.name;
    for (const child of node.children ?? []) {
      collectFrames(child, frames, childPrefix);
    }
  }
  // Other node types (GROUP, INSTANCE, TEXT, etc.) at top level: ignore
}

/**
 * Fetch thumbnail URLs for a list of frame IDs.
 * Returns a map from nodeId → thumbnailUrl.
 * This is a separate API call and slower — use sparingly.
 */
export async function fetchFigmaThumbnails(
  fileKey: string,
  nodeIds: string[],
  tokenOverride?: string
): Promise<Record<string, string>> {
  const token = tokenOverride ?? process.env.FIGMA_ACCESS_TOKEN;
  if (!token || nodeIds.length === 0) return {};

  const ids = nodeIds.join(',');
  const res = await fetch(
    `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=0.5`,
    { headers: { 'X-Figma-Token': token }, cache: 'no-store' }
  );

  if (!res.ok) return {};
  const data = (await res.json()) as { images?: Record<string, string> };
  return data.images ?? {};
}
