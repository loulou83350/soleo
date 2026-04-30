import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { getProjectById } from '@/lib/repositories/projects';
import { getSessionWithBlocks } from '@/lib/repositories/sessions';
import {
  listParticipantsForSession,
  getAllResponsesForSession,
} from '@/lib/repositories/participant-sessions';
import { getOrCreateFinding } from '@/lib/repositories/findings';
import {
  getActiveProvider,
  getAvailableProviders,
} from '@/lib/ai/providers';
import { ANCHOR_BLOCK_TYPES } from '@/lib/domain/blocks';
import { FindingsEditor } from './FindingsEditor';
import type { CitationSource } from '@/components/findings/CitationPill';

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function FindingsPage({ params }: Props) {
  const { id, sessionId: sessionIdParam } = await params;
  const projectId = parseInt(id, 10);
  const sessionId = parseInt(sessionIdParam, 10);
  if (isNaN(projectId) || isNaN(sessionId)) notFound();

  const user = await getUser();
  if (!user) notFound();
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) notFound();

  const [project, session] = await Promise.all([
    getProjectById(projectId, userWithTeam.teamId),
    getSessionWithBlocks(sessionId, userWithTeam.teamId),
  ]);
  if (!project || !session) notFound();

  const [finding, participants, responses] = await Promise.all([
    getOrCreateFinding(sessionId, userWithTeam.teamId),
    listParticipantsForSession(sessionId),
    getAllResponsesForSession(sessionId),
  ]);
  if (!finding) notFound();

  // Build the citation source map for the renderer
  const sources = buildCitationSources({
    projectId,
    sessionId,
    blocks: session.blocks,
    participants,
    responses,
  });

  const availableProviders = getAvailableProviders();
  const activeProvider = getActiveProvider();

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href={`/dashboard/projects/${projectId}/sessions/${sessionId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {session.title}
        </Link>

        <FindingsEditor
          finding={finding}
          sources={Array.from(sources.entries())}
          availableProviders={availableProviders}
          activeProvider={activeProvider}
          context={{ projectId, sessionId }}
        />
      </div>
    </div>
  );
}

// ─── Build the citation source map ───────────────────────────────────────────

function buildCitationSources({
  projectId,
  sessionId,
  blocks,
  participants,
  responses,
}: {
  projectId: number;
  sessionId: number;
  blocks: Array<{ id: number; blockType: string; config: unknown; position: number }>;
  participants: Array<{ id: number; participantToken: string }>;
  responses: Array<{ responseId: number; participantSessionId: number; blockId: number; value: unknown }>;
}): Map<number, CitationSource> {
  // participantSessions.id → { number, token }
  const partInfo = new Map<number, { number: number; token: string }>();
  // List in display order (most recent first as in listParticipantsForSession), then number from end
  participants.forEach((p, idx) => {
    partInfo.set(p.id, {
      number: participants.length - idx,
      token: p.participantToken,
    });
  });

  // blockId → question label
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
      participantToken: part.token,
      question: blockLabel.get(r.blockId) ?? '',
      text: stringifyResponseForDisplay(r.value),
      projectId,
      sessionId,
    });
  }
  return sources;
}

function stringifyResponseForDisplay(value: unknown): string {
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
