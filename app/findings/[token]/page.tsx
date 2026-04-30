import { notFound } from 'next/navigation';
import { getPublishedFindingByToken } from '@/lib/repositories/findings';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  listParticipantsForSession,
  getAllResponsesForSession,
} from '@/lib/repositories/participant-sessions';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { MarkdownWithCitations } from '@/components/findings/MarkdownWithCitations';
import type { CitationSource } from '@/components/findings/CitationPill';
import type { SessionBlock } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicFindingsPage({ params }: Props) {
  const { token } = await params;
  const finding = await getPublishedFindingByToken(token);
  if (!finding) notFound();

  // No team check needed — the token is the access credential.
  // We need session + responses to build the citation source map.
  // Fetch by sessionId (no team filter — public).
  const sessionData = await getSessionForPublicFinding(finding.sessionId);
  if (!sessionData) notFound();

  const { session, participants, responses } = sessionData;

  const sources = buildCitationSources({ session: session.blocks, participants, responses });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 px-6 py-12">
        <article className="max-w-3xl mx-auto space-y-8">
          {finding.title && (
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground leading-tight">
              {finding.title}
            </h1>
          )}
          <MarkdownWithCitations
            markdown={finding.bodyMarkdown}
            sources={sources}
            withParticipantLink={false}
          />
        </article>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Rapport généré avec{' '}
        <a
          href="/"
          className="font-medium hover:text-foreground transition-colors"
        >
          Soleo
        </a>
      </footer>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const finding = await getPublishedFindingByToken(token);
  if (!finding) return { title: 'Rapport introuvable' };
  return {
    title: finding.title || 'Rapport Soleo',
    robots: { index: false, follow: false },
  };
}

// ─── Internal: load minimum data needed for the public viewer ────────────────

async function getSessionForPublicFinding(sessionId: number) {
  // Public access: load session blocks + participants + responses without
  // team check. We never expose the participant token via this page (links
  // are stripped in the renderer with withParticipantLink={false}).
  const { db } = await import('@/lib/db/drizzle');
  const { sessions, sessionBlocks } = await import('@/lib/db/schema');
  const { eq, asc } = await import('drizzle-orm');

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return null;

  const blocks = await db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.position));

  const [participants, responses] = await Promise.all([
    listParticipantsForSession(sessionId),
    getAllResponsesForSession(sessionId),
  ]);

  return {
    session: { ...session, blocks },
    participants,
    responses,
  };
}

function buildCitationSources({
  session: blocks,
  participants,
  responses,
}: {
  session: SessionBlock[];
  participants: Array<{ id: number; participantToken: string }>;
  responses: Array<{ responseId: number; participantSessionId: number; blockId: number; value: unknown }>;
}): Map<number, CitationSource> {
  const partInfo = new Map<number, { number: number; token: string }>();
  participants.forEach((p, idx) => {
    partInfo.set(p.id, {
      number: participants.length - idx,
      token: p.participantToken,
    });
  });

  const blockLabel = new Map<number, string>();
  for (const b of blocks) {
    if (ANCHOR_BLOCK_TYPES.includes(b.blockType as 'welcome' | 'thank_you')) continue;
    const cfg = (b.config ?? {}) as Record<string, unknown>;
    const q = typeof cfg.question === 'string' ? cfg.question : b.blockType;
    blockLabel.set(b.id, q);
  }

  const sources = new Map<number, CitationSource>();
  for (const r of responses) {
    const part = partInfo.get(r.participantSessionId);
    if (!part) continue;
    sources.set(r.responseId, {
      responseId: r.responseId,
      participantNumber: part.number,
      // No participantToken / projectId / sessionId in public viewer
      question: blockLabel.get(r.blockId) ?? '',
      text: stringifyForDisplay(r.value),
    });
  }
  return sources;
}

function stringifyForDisplay(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return (value as string[]).join(', ');
    if (value.every((v) => v && typeof v === 'object' && 'label' in v)) {
      return (value as Array<{ label?: string }>).map((i) => i.label ?? '').filter(Boolean).join(' > ');
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' | ');
  }
  try { return JSON.stringify(value); } catch { return ''; }
}
