import type { SessionBlock } from '@/lib/db/schema';
import { formatDuration } from '@/lib/utils';

// ─── Renderer entry ──────────────────────────────────────────────────────────

interface ResponseRendererProps {
  block: SessionBlock;
  value: unknown;
}

export function ResponseRenderer({ block, value }: ResponseRendererProps) {
  const config = (block.config ?? {}) as Record<string, unknown>;

  // No answer recorded → either skipped, no-op block (welcome/thank_you), or missing
  if (value === null || value === undefined) {
    if (block.blockType === 'welcome' || block.blockType === 'thank_you' || block.blockType === 'content') {
      return null;
    }
    return <NoAnswer />;
  }

  switch (block.blockType) {
    case 'short_text':
    case 'long_text':
      return <TextResponse value={String(value)} />;
    case 'mcq':
      return <McqResponse value={value} />;
    case 'likert':
      return <LikertResponse value={value} config={config} />;
    case 'rating':
      return <RatingResponse value={value} max={Number(config.max ?? 5)} />;
    case 'nps':
      return <NpsResponse value={value} />;
    case 'card_sort':
      return <CardSortResponse value={value} />;
    case 'matrix':
      return <MatrixResponse value={value} />;
    case 'first_impression':
      return <FirstImpressionResponse />;
    case 'prototype_task':
      return <PrototypeTaskResponse value={value} />;
    default:
      return <NoAnswer />;
  }
}

// ─── Per-type renderers ──────────────────────────────────────────────────────

function NoAnswer() {
  return (
    <p className="text-sm text-muted-foreground italic">Pas de réponse</p>
  );
}

function TextResponse({ value }: { value: string }) {
  if (!value.trim()) return <NoAnswer />;
  return (
    <blockquote className="border-l-2 border-border pl-4 py-1 text-sm text-foreground whitespace-pre-wrap">
      {value}
    </blockquote>
  );
}

function McqResponse({ value }: { value: unknown }) {
  const options = Array.isArray(value) ? (value as string[]) : [];
  if (options.length === 0) return <NoAnswer />;
  return (
    <ul className="space-y-1.5">
      {options.map((opt, idx) => (
        <li
          key={idx}
          className="text-sm text-foreground inline-flex items-center gap-2 mr-2 px-2.5 py-1 bg-muted rounded"
        >
          ✓ {opt}
        </li>
      ))}
    </ul>
  );
}

function LikertResponse({ value, config }: { value: unknown; config: Record<string, unknown> }) {
  const n = typeof value === 'number' ? value : Number(value);
  const scale = Number(config.scale ?? 5);
  const lowLabel = String(config.lowLabel ?? '');
  const highLabel = String(config.highLabel ?? '');
  if (!Number.isFinite(n)) return <NoAnswer />;
  return (
    <div className="text-sm text-foreground">
      <span className="font-semibold">{n}</span>
      <span className="text-muted-foreground"> / {scale}</span>
      {(lowLabel || highLabel) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {lowLabel} → {highLabel}
        </p>
      )}
    </div>
  );
}

function RatingResponse({ value, max }: { value: unknown; max: number }) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return <NoAnswer />;
  return (
    <div className="text-sm text-foreground inline-flex items-baseline gap-1">
      <span className="text-lg font-semibold text-foreground">★ {n}</span>
      <span className="text-muted-foreground"> / {max}</span>
    </div>
  );
}

function NpsResponse({ value }: { value: unknown }) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return <NoAnswer />;
  const category =
    n <= 6 ? { label: 'Détracteur', cls: 'bg-destructive/15 text-destructive' } :
    n <= 8 ? { label: 'Passif',     cls: 'bg-muted text-muted-foreground'    } :
             { label: 'Promoteur',  cls: 'bg-success/15 text-success'        };
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-semibold text-foreground tabular-nums">{n}/10</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${category.cls}`}>
        {category.label}
      </span>
    </div>
  );
}

function CardSortResponse({ value }: { value: unknown }) {
  const items = Array.isArray(value)
    ? (value as Array<{ label?: string; imageUrl?: string }>)
    : [];
  if (items.length === 0) return <NoAnswer />;
  return (
    <ol className="space-y-1.5 list-decimal list-inside">
      {items.map((item, idx) => (
        <li key={idx} className="text-sm text-foreground">
          {item?.label || <em className="text-muted-foreground">(sans libellé)</em>}
        </li>
      ))}
    </ol>
  );
}

function MatrixResponse({ value }: { value: unknown }) {
  const map = (value && typeof value === 'object' ? (value as Record<string, string>) : {});
  const entries = Object.entries(map);
  if (entries.length === 0) return <NoAnswer />;
  return (
    <ul className="space-y-1">
      {entries.map(([row, col]) => (
        <li key={row} className="text-sm text-foreground">
          <span className="text-muted-foreground">{row} :</span>{' '}
          <span className="font-medium">{col}</span>
        </li>
      ))}
    </ul>
  );
}

function FirstImpressionResponse() {
  return (
    <p className="text-sm text-muted-foreground italic">Stimulus présenté</p>
  );
}

interface PrototypeResult {
  completed?: boolean;
  skipped?: boolean;
  manualCompletion?: boolean;
  goalReached?: boolean;
  timeOnTask?: number | null;
  navigations?: Array<{ nodeId: string; at: number }>;
}

function PrototypeTaskResponse({ value }: { value: unknown }) {
  const r = (value ?? {}) as PrototypeResult;
  const navigations = r.navigations ?? [];

  // Status badge
  let statusLabel = 'En cours';
  let statusCls = 'bg-muted text-muted-foreground';
  if (r.skipped) {
    statusLabel = 'Abandonnée';
    statusCls = 'bg-muted text-muted-foreground';
  } else if (r.completed) {
    if (r.goalReached) {
      statusLabel = 'Objectif atteint';
      statusCls = 'bg-success/15 text-success';
    } else if (r.manualCompletion) {
      statusLabel = 'Marquée terminée';
      statusCls = 'bg-blue-100 text-blue-700';
    } else {
      statusLabel = 'Complétée';
      statusCls = 'bg-success/15 text-success';
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls}`}>
          {statusLabel}
        </span>
        {r.timeOnTask != null && (
          <span className="text-muted-foreground tabular-nums">
            Durée : {formatDuration(r.timeOnTask / 1000)}
          </span>
        )}
        {navigations.length > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {navigations.length} {navigations.length > 1 ? 'écrans' : 'écran'}
          </span>
        )}
      </div>

      {/* Navigation timeline (Story 4.4 data) */}
      {navigations.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Voir la timeline des navigations
          </summary>
          <ol className="mt-2 space-y-1 pl-4 border-l-2 border-border">
            {navigations.map((nav, idx) => {
              const startAt = navigations[0]?.at ?? nav.at;
              const elapsedMs = nav.at - startAt;
              return (
                <li key={idx} className="text-muted-foreground tabular-nums">
                  <span className="text-muted-foreground/60">+{Math.round(elapsedMs / 1000)}s</span>{' '}
                  <span className="text-foreground/80">{nav.nodeId}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </div>
  );
}
