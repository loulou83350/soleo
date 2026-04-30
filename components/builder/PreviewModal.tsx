'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, BookOpen, Flag, Star, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SessionWithBlocks, SessionBlock } from '@/lib/db/schema';
import type { BlockVisibilityRule, BlockCondition } from '@/lib/domain/types';
import { BLOCK_LABELS } from '@/lib/domain/blocks';

// ─── Condition evaluation ─────────────────────────────────────────────────────

function evaluateCond(cond: BlockCondition, responses: Map<number, unknown>): boolean {
  const val = responses.get(cond.sourceBlockId);
  const hasValue = val !== undefined && val !== '' && val !== null &&
    !(Array.isArray(val) && val.length === 0);
  switch (cond.operator) {
    case 'answered':     return hasValue;
    case 'not_answered': return !hasValue;
    case 'eq':           return String(val ?? '') === (cond.value ?? '');
    case 'neq':          return String(val ?? '') !== (cond.value ?? '');
  }
}

function isBlockVisible(block: SessionBlock, responses: Map<number, unknown>): boolean {
  const rule = block.conditions as BlockVisibilityRule;
  if (!rule || rule.conditions.length === 0) return true;
  const results = rule.conditions.map((c) => evaluateCond(c, responses));
  return rule.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

// ─── Figma embed helpers ──────────────────────────────────────────────────────

function toFigmaEmbedUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('figma.com')) return url;
    if (!u.pathname.startsWith('/proto/') && !u.pathname.startsWith('/design/')) return url;

    // Build a clean embed URL from scratch — strip stale session tokens (t=, p=, scaling=…)
    // that can cause Figma to return 500 when reused inside embed.figma.com.
    const embed = new URL(`https://embed.figma.com${u.pathname}`);
    const nodeId  = u.searchParams.get('node-id');
    const pageId  = u.searchParams.get('page-id');
    const startId = u.searchParams.get('starting-point-node-id');
    if (nodeId)  embed.searchParams.set('node-id', nodeId);
    if (pageId)  embed.searchParams.set('page-id', pageId);
    if (startId) embed.searchParams.set('starting-point-node-id', startId);

    // Embed API client-id — enables postMessage events (PRESENTED_NODE_CHANGED, etc.)
    const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID;
    if (clientId) embed.searchParams.set('client-id', clientId);
    embed.searchParams.set('embed-host', 'share');
    return embed.toString();
  } catch {
    return url;
  }
}

function extractFigmaNodeId(url: string): string | null {
  if (!url) return null;
  try {
    const raw = new URL(url).searchParams.get('node-id');
    if (!raw) return null;
    // Figma URLs use "1234-567"; postMessage uses "1234:567"
    return raw.replace('-', ':');
  } catch { return null; }
}

// ─── Card sort sortable item ──────────────────────────────────────────────────

type CardItem = { label: string; imageUrl?: string };

function SortableCardItem({ id, item }: { id: string; item: CardItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border border-border rounded-lg p-3 bg-background hover:border-foreground/30 transition-colors select-none"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0"
        aria-label="Glisser pour réordonner"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-12 w-16 object-cover rounded shrink-0" />
      )}
      <span className="text-sm text-foreground">{item.label || `Carte`}</span>
    </div>
  );
}

// ─── Prototype task block — identical experience to participant view ───────────

function PrototypeTaskBlock({
  block,
  onResponse,
}: {
  block: SessionBlock;
  onResponse: (blockId: number, value: unknown) => void;
}) {
  const cfg          = block.config as Record<string, unknown>;
  const instructions = typeof cfg.instructions === 'string' ? cfg.instructions : '';
  const url          = typeof cfg.url          === 'string' ? cfg.url          : '';
  const taskType     = typeof cfg.taskType     === 'string' ? cfg.taskType     : 'explore';
  const goalFrameUrl = typeof cfg.goalFrameUrl === 'string' ? cfg.goalFrameUrl : '';

  // Prefer direct goalNodeId from screen picker; fall back to parsing goalFrameUrl
  const rawGoalNodeId = typeof cfg.goalNodeId === 'string' && cfg.goalNodeId
    ? cfg.goalNodeId
    : (goalFrameUrl ? extractFigmaNodeId(goalFrameUrl) : null);
  const goalNodeId = rawGoalNodeId && taskType === 'goal' ? rawGoalNodeId : null;
  const embedUrl   = toFigmaEmbedUrl(url);

  type Phase = 'instructions' | 'running' | 'done';
  const [phase, setPhase]           = useState<Phase>('instructions');
  const [goalReached, setGoalReached] = useState(false);
  const [skipped, setSkipped]         = useState(false);
  const startedAtRef = useRef<number | null>(null);

  // Figma postMessage listener — auto-detects goal frame
  useEffect(() => {
    if (phase !== 'running') return;

    // Mount diagnostic — fired once when listener attaches
    console.debug('[Soleo] postMessage listener attached. Goal:', goalNodeId, '| URL:', embedUrl);

    function handleMessage(event: MessageEvent) {
      // DIAGNOSTIC: log EVERY message regardless of origin so we see what's actually arriving
      console.debug('[Soleo] window.message:', { origin: event.origin, data: event.data });

      // Accept only messages from Figma
      if (!String(event.origin).includes('figma.com')) return;

      // Handle both object and stringified-JSON payloads
      let data: Record<string, unknown> = {};
      if (typeof event.data === 'string') {
        try { data = JSON.parse(event.data); } catch { return; }
      } else if (event.data && typeof event.data === 'object') {
        data = event.data as Record<string, unknown>;
      } else {
        return;
      }

      if (data.type !== 'PRESENTED_NODE_CHANGED') return;

      // Handle both nested (data.data.presentedNodeId) and flat (data.presentedNodeId)
      const inner = data.data as Record<string, unknown> | undefined;
      const rawId = (inner?.presentedNodeId ?? data.presentedNodeId) as string | undefined;
      if (!rawId) return;

      // Normalize: Figma URLs use '-', postMessage uses ':'
      const normalizedId = String(rawId).replace(/-/g, ':');
      console.debug('[Soleo] Figma node changed:', normalizedId, '| goal:', goalNodeId);

      if (goalNodeId && (normalizedId === goalNodeId || rawId === goalNodeId)) {
        setGoalReached(true);
        onResponse(block.id, {
          completed: true,
          skipped: false,
          timeOnTask: startedAtRef.current ? Date.now() - startedAtRef.current : null,
          goalReached: true,
        });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [phase, goalNodeId, block.id, onResponse]);

  function handleIframeLoad() {
    startedAtRef.current = Date.now();
  }

  function handleSkip() {
    onResponse(block.id, {
      completed: false,
      skipped: true,
      timeOnTask: startedAtRef.current ? Date.now() - startedAtRef.current : null,
      goalReached: false,
    });
    setSkipped(true);
    setPhase('done');
  }

  function handleManualComplete() {
    onResponse(block.id, {
      completed: true,
      skipped: false,
      manualCompletion: true,
      timeOnTask: startedAtRef.current ? Date.now() - startedAtRef.current : null,
      goalReached: false,
    });
    setGoalReached(true); // show overlay
    setTimeout(() => setPhase('done'), 1200);
  }

  // ── Instructions phase ──
  if (phase === 'instructions') {
    return (
      <div className="space-y-6 py-2">
        {instructions && (
          <p className="text-base text-foreground leading-relaxed">{instructions}</p>
        )}
        {!url ? (
          <p className="text-sm text-destructive">Aucun prototype configuré pour cette tâche.</p>
        ) : (
          <button
            type="button"
            onClick={() => setPhase('running')}
            className="px-6 py-2.5 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Démarrer la tâche →
          </button>
        )}
      </div>
    );
  }

  // ── Done phase ──
  if (phase === 'done') {
    return (
      <div className="text-center space-y-3 py-8">
        {skipped ? (
          <p className="text-base text-muted-foreground">Tâche abandonnée.</p>
        ) : (
          <>
            <div className="text-4xl">✅</div>
            <p className="text-base font-semibold text-foreground">Tâche complétée !</p>
          </>
        )}
      </div>
    );
  }

  // ── Running phase ──
  return (
    <div className="space-y-3">
      <div className="relative border border-border rounded-lg overflow-hidden" style={{ height: 480 }}>
        <iframe
          src={embedUrl}
          className="w-full h-full"
          title="Prototype"
          onLoad={handleIframeLoad}
          allow="fullscreen"
        />
        {goalReached && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="bg-background rounded-xl p-8 text-center space-y-3 max-w-xs shadow-xl">
              <div className="text-4xl">✅</div>
              <p className="text-lg font-semibold text-foreground">Tâche complétée !</p>
              <p className="text-sm text-muted-foreground">Vous avez atteint l'écran cible.</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
        >
          Abandonner la tâche
        </button>
        <button
          type="button"
          onClick={handleManualComplete}
          className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
        >
          J&apos;ai terminé la tâche →
        </button>
      </div>
    </div>
  );
}

// ─── Block renderers ──────────────────────────────────────────────────────────

function PreviewBlock({
  block,
  responses,
  onResponse,
}: {
  block: SessionBlock;
  responses: Map<number, unknown>;
  onResponse: (blockId: number, value: unknown) => void;
}) {
  const cfg = block.config as Record<string, unknown>;
  const question = typeof cfg.question === 'string' ? cfg.question : '';
  const label = BLOCK_LABELS[block.blockType as keyof typeof BLOCK_LABELS] ?? block.blockType;

  const QuestionHeader = () => (
    <div className="mb-3">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      {question && <p className="text-sm font-medium text-foreground leading-snug">{question}</p>}
      {block.required && <span className="text-[10px] text-destructive">* Obligatoire</span>}
    </div>
  );

  const val = responses.get(block.id);

  switch (block.blockType) {
    case 'content': {
      const title = typeof cfg.title === 'string' ? cfg.title : '';
      const body  = typeof cfg.body  === 'string' ? cfg.body  : '';
      return (
        <div className="space-y-1">
          {title && <p className="text-base font-semibold text-foreground">{title}</p>}
          {body  && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{body}</p>}
        </div>
      );
    }

    case 'short_text':
      return (
        <div>
          <QuestionHeader />
          <input
            type="text"
            value={(val as string) ?? ''}
            onChange={(e) => onResponse(block.id, e.target.value)}
            placeholder={typeof cfg.placeholder === 'string' ? cfg.placeholder : ''}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
          />
        </div>
      );

    case 'long_text':
      return (
        <div>
          <QuestionHeader />
          <textarea
            rows={4}
            value={(val as string) ?? ''}
            onChange={(e) => onResponse(block.id, e.target.value)}
            placeholder={typeof cfg.placeholder === 'string' ? cfg.placeholder : ''}
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none"
          />
        </div>
      );

    case 'mcq': {
      const options = Array.isArray(cfg.options) ? cfg.options as string[] : [];
      const allowMultiple = cfg.allowMultiple === true;
      const selected = (val as string[]) ?? [];

      function toggle(opt: string) {
        if (allowMultiple) {
          const next = selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt];
          onResponse(block.id, next);
        } else {
          onResponse(block.id, selected[0] === opt ? [] : [opt]);
        }
      }

      return (
        <div>
          <QuestionHeader />
          <div className="space-y-1.5">
            {options.map((opt, i) => {
              const isChecked = selected.includes(opt);
              return (
                <button
                  key={i}
                  onClick={() => toggle(opt)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    isChecked
                      ? 'border-foreground bg-foreground/5 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                  }`}
                >
                  <span className={`h-4 w-4 shrink-0 ${allowMultiple ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center ${
                    isChecked ? 'border-foreground bg-foreground' : 'border-muted-foreground/40'
                  }`}>
                    {isChecked && <span className="h-2 w-2 rounded-full bg-background block" />}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case 'likert': {
      const scale = Number(cfg.scale) || 5;
      const lowLabel  = typeof cfg.lowLabel  === 'string' ? cfg.lowLabel  : '';
      const highLabel = typeof cfg.highLabel === 'string' ? cfg.highLabel : '';
      const current = val as number | undefined;

      return (
        <div>
          <QuestionHeader />
          <div className="flex gap-1.5 justify-between">
            {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => onResponse(block.id, n)}
                className={`flex-1 py-2 rounded-md border text-xs font-medium transition-colors ${
                  current === n
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{lowLabel}</span>
            <span className="text-[10px] text-muted-foreground">{highLabel}</span>
          </div>
        </div>
      );
    }

    case 'rating': {
      const max = Number(cfg.max) || 5;
      const current = (val as number) ?? 0;

      return (
        <div>
          <QuestionHeader />
          <div className="flex gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => onResponse(block.id, n)}
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    n <= current ? 'fill-foreground text-foreground' : 'text-muted-foreground/30'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'nps': {
      const lowLabel  = typeof cfg.lowLabel  === 'string' ? cfg.lowLabel  : 'Pas du tout probable';
      const highLabel = typeof cfg.highLabel === 'string' ? cfg.highLabel : 'Très probable';
      const current = val as number | undefined;

      return (
        <div>
          <QuestionHeader />
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                onClick={() => onResponse(block.id, n)}
                className={`h-9 w-9 text-xs font-medium rounded border transition-colors ${
                  current === n
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">{lowLabel}</span>
            <span className="text-[10px] text-muted-foreground">{highLabel}</span>
          </div>
        </div>
      );
    }

    case 'card_sort': {
      const items = Array.isArray(cfg.items) ? cfg.items as CardItem[] : [];
      const currentOrder = (val as CardItem[]) ?? items;

      const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
      );

      function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
          const oldIdx = currentOrder.findIndex((_, i) => String(i) === active.id);
          const newIdx = currentOrder.findIndex((_, i) => String(i) === over.id);
          const next = arrayMove(currentOrder, oldIdx, newIdx);
          onResponse(block.id, next);
        }
      }

      return (
        <div>
          <QuestionHeader />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={currentOrder.map((_, i) => String(i))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {currentOrder.map((item, i) => (
                  <SortableCardItem key={i} id={String(i)} item={item} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      );
    }

    case 'matrix': {
      const rows    = Array.isArray(cfg.rows)    ? cfg.rows    as string[] : [];
      const columns = Array.isArray(cfg.columns) ? cfg.columns as string[] : [];
      const current = (val as Record<string, string>) ?? {};

      return (
        <div>
          <QuestionHeader />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-1 pr-3 text-muted-foreground font-normal" />
                  {columns.map((col, i) => (
                    <th key={i} className="text-center py-1 px-2 text-muted-foreground font-medium">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-border/50">
                    <td className="py-2 pr-3 text-foreground text-sm">{row}</td>
                    {columns.map((col, ci) => (
                      <td key={ci} className="text-center py-2 px-2">
                        <button
                          onClick={() => onResponse(block.id, { ...current, [row]: col })}
                          className={`h-4 w-4 rounded-full border-2 mx-auto block transition-colors ${
                            current[row] === col
                              ? 'border-foreground bg-foreground'
                              : 'border-muted-foreground/40 hover:border-foreground/50'
                          }`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case 'first_impression': {
      const imageUrl     = typeof cfg.imageUrl     === 'string' ? cfg.imageUrl     : '';
      const duration     = Number(cfg.duration ?? 5);
      const instructions = typeof cfg.instructions === 'string' ? cfg.instructions : '';

      return (
        <FirstImpressionPreview
          blockId={block.id}
          imageUrl={imageUrl}
          duration={duration}
          instructions={instructions}
          onDone={() => onResponse(block.id, 'seen')}
        />
      );
    }

    case 'prototype_task':
      return <PrototypeTaskBlock block={block} onResponse={onResponse} />;

    default:
      return null;
  }
}

// ─── First impression (timed reveal) ─────────────────────────────────────────

function FirstImpressionPreview({
  blockId, imageUrl, duration, instructions, onDone,
}: {
  blockId: number;
  imageUrl: string;
  duration: number;
  instructions: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'instructions' | 'image' | 'done'>('instructions');
  const [remaining, setRemaining] = useState(duration);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startReveal() {
    setPhase('image');
    setRemaining(duration);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          setPhase('done');
          onDone();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // blockId is used to reset state if the block changes — not used directly but kept for key
  void blockId;

  if (phase === 'instructions') {
    return (
      <div className="text-center space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          {instructions || `Regardez attentivement l'image qui va apparaître pendant ${duration} secondes.`}
        </p>
        <button
          onClick={startReveal}
          className="px-4 py-2 text-sm bg-foreground text-background rounded-md hover:opacity-90 transition-opacity"
        >
          Je suis prêt(e)
        </button>
      </div>
    );
  }

  if (phase === 'image') {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {remaining} s
          </span>
        </div>
        {imageUrl
          ? <img src={imageUrl} alt="Premier regard" className="w-full rounded-lg border border-border" /> // eslint-disable-line @next/next/no-img-element
          : <div className="h-48 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">Image non définie</div>
        }
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground">Image masquée — vos questions suivent ci-dessous.</p>
    </div>
  );
}

// ─── Preview modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  session: SessionWithBlocks;
  onClose: () => void;
}

export function PreviewModal({ session, onClose }: PreviewModalProps) {
  // Each block is its own step — one per screen (Typeform/Maze style)
  const allBlocks = session.blocks;

  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<Map<number, unknown>>(new Map());

  const currentBlock = allBlocks[stepIdx] ?? null;

  function setResponse(blockId: number, value: unknown) {
    setResponses((prev) => new Map(prev).set(blockId, value));
  }

  function goNext() {
    if (stepIdx < allBlocks.length - 1) setStepIdx((i) => i + 1);
  }
  function goPrev() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isFirst = stepIdx === 0;
  const isLast  = stepIdx === allBlocks.length - 1;

  // Welcome block config helpers
  const cfg = (currentBlock?.config ?? {}) as Record<string, unknown>;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Prévisualisation de la session"
    >
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prévisualisation
          </span>
          <span className="text-xs text-muted-foreground">
            Étape {stepIdx + 1} / {allBlocks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {allBlocks.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx ? 'w-6 bg-foreground' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
              aria-label={`Aller à l'étape ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fermer la prévisualisation"
        >
          <X className="h-4 w-4" />
          Fermer
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

          {/* Welcome block */}
          {currentBlock?.blockType === 'welcome' && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                <h1 className="text-2xl font-semibold text-foreground">
                  {typeof cfg.title === 'string' && cfg.title ? cfg.title : session.title}
                </h1>
                {typeof cfg.description === 'string' && cfg.description && (
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {cfg.description}
                  </p>
                )}
              </div>
              <button
                onClick={goNext}
                className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                {typeof cfg.buttonText === 'string' && cfg.buttonText ? cfg.buttonText : 'Commencer'}
              </button>
            </div>
          )}

          {/* Thank you block */}
          {currentBlock?.blockType === 'thank_you' && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Flag className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  {typeof cfg.title === 'string' && cfg.title ? cfg.title : 'Merci !'}
                </h1>
                {typeof cfg.description === 'string' && cfg.description && (
                  <p className="text-sm text-muted-foreground">{cfg.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Regular question block — only show if visible per conditions */}
          {currentBlock &&
            currentBlock.blockType !== 'welcome' &&
            currentBlock.blockType !== 'thank_you' &&
            isBlockVisible(currentBlock, responses) && (
              <PreviewBlock
                block={currentBlock}
                responses={responses}
                onResponse={setResponse}
              />
            )}

          {/* Block hidden by conditions */}
          {currentBlock &&
            currentBlock.blockType !== 'welcome' &&
            currentBlock.blockType !== 'thank_you' &&
            !isBlockVisible(currentBlock, responses) && (
              <p className="text-sm text-muted-foreground text-center italic py-8">
                Ce bloc n'est pas affiché (conditions non remplies).
              </p>
            )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="h-16 border-t border-border flex items-center justify-between px-6 shrink-0 bg-background">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </button>

        <span className="text-xs text-muted-foreground">
          {currentBlock?.blockType === 'welcome' ? 'Introduction' :
           currentBlock?.blockType === 'thank_you' ? 'Fin' :
           `Étape ${stepIdx}`}
        </span>

        {/* On welcome block, the button is embedded in the content */}
        {currentBlock?.blockType !== 'welcome' && (
          <button
            onClick={isLast ? onClose : goNext}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
          >
            {isLast ? 'Fermer' : 'Suivant'}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        {currentBlock?.blockType === 'welcome' && (
          <span /> /* keeps layout balanced */
        )}
      </div>
    </div>
  );
}
