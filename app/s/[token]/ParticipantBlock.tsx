'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
import { GripVertical, Star } from 'lucide-react';
import type { SessionBlock } from '@/lib/db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParticipantBlockProps {
  block: SessionBlock;
  value: unknown;
  onChange: (value: unknown) => void;
  onNext?: () => void;
  requiredError: boolean;
}

// ─── Sortable card item (card_sort) ──────────────────────────────────────────

function SortableCardItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
        aria-label="Réordonner"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}

// ─── Block renderers ──────────────────────────────────────────────────────────

function ShortTextBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </label>
      <textarea
        className={`w-full text-base border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-none transition-colors ${
          requiredError ? 'border-destructive' : 'border-border'
        }`}
        rows={3}
        placeholder={String(config.placeholder || '')}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={true}
        aria-invalid={requiredError}
      />
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function LongTextBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </label>
      <textarea
        className={`w-full text-base border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-none transition-colors ${
          requiredError ? 'border-destructive' : 'border-border'
        }`}
        rows={6}
        placeholder={String(config.placeholder || '')}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={true}
        aria-invalid={requiredError}
      />
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function McqBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  const options = Array.isArray(config.options) ? config.options as string[] : [];
  const allowMultiple = !!config.allowMultiple;
  const selected: string[] = Array.isArray(value) ? value as string[] : [];

  function toggle(opt: string) {
    if (allowMultiple) {
      const next = selected.includes(opt)
        ? selected.filter((o) => o !== opt)
        : [...selected, opt];
      onChange(next);
    } else {
      onChange([opt]);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <div className="space-y-2" role={allowMultiple ? 'group' : 'radiogroup'} aria-label={String(config.question || '')}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              role={allowMultiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              onClick={() => toggle(opt)}
              className={`w-full text-left px-5 py-3.5 rounded-xl border text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
                isSelected
                  ? 'border-foreground bg-foreground/5 font-medium'
                  : 'border-border bg-background hover:border-foreground/30'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function LikertBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  const scale = Number(config.scale) || 5;
  const lowLabel = String(config.lowLabel || '');
  const highLabel = String(config.highLabel || '');
  const selected = typeof value === 'number' ? value : null;

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <div className="space-y-2">
        <div className="flex gap-2" role="radiogroup" aria-label={String(config.question || '')}>
          {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected === n}
              onClick={() => onChange(n)}
              className={`flex-1 h-12 rounded-lg border text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
                selected === n
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background hover:border-foreground/30'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(lowLabel || highLabel) && (
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>
        )}
      </div>
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function RatingBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  const max = Number(config.max) || 5;
  const selected = typeof value === 'number' ? value : 0;
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-4">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <div className="flex gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                n <= (hovered || selected)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          </button>
        ))}
      </div>
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function NpsBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  const lowLabel = String(config.lowLabel || '');
  const highLabel = String(config.highLabel || '');
  const selected = typeof value === 'number' ? value : null;

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <div className="space-y-2">
        <div className="flex gap-1.5" role="radiogroup" aria-label={String(config.question || '')}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected === n}
              onClick={() => onChange(n)}
              className={`flex-1 h-11 rounded-lg border text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
                selected === n
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background hover:border-foreground/30'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(lowLabel || highLabel) && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>
        )}
      </div>
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function CardSortBlock({ config, value, onChange }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const rawItems = Array.isArray(config.items)
    ? (config.items as Array<{ label: string; imageUrl?: string }>)
    : [];

  const [items, setItems] = useState(() =>
    (Array.isArray(value) ? (value as Array<{ label: string }>) : rawItems)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((item) => item.label === active.id);
    const newIdx = items.findIndex((item) => item.label === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);
    onChange(reordered);
  }

  const ids = items.map((item) => item.label);

  return (
    <div className="space-y-4">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <p className="text-sm text-muted-foreground">
        Faites glisser les cartes pour les classer dans l'ordre qui vous semble le plus logique.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableCardItem key={item.label} id={item.label} label={item.label} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function MatrixBlock({ config, value, onChange, requiredError }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
  requiredError: boolean;
}) {
  const rows = Array.isArray(config.rows) ? config.rows as string[] : [];
  const cols = Array.isArray(config.columns) ? config.columns as string[] : [];
  const selected = (value as Record<string, string> | null) ?? {};

  function handleSelect(row: string, col: string) {
    onChange({ ...selected, [row]: col });
  }

  return (
    <div className="space-y-4">
      <p className="text-xl font-semibold text-foreground leading-snug">
        {String(config.question || '')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 font-normal text-muted-foreground w-40" />
              {cols.map((col) => (
                <th key={col} className="text-center py-2 px-3 font-medium text-foreground text-xs">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} className="border-t border-border">
                <td className="py-3 pr-4 text-foreground">{row}</td>
                {cols.map((col) => (
                  <td key={col} className="py-3 px-3 text-center">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected[row] === col}
                      onClick={() => handleSelect(row, col)}
                      className={`h-5 w-5 rounded-full border-2 mx-auto transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 ${
                        selected[row] === col
                          ? 'border-foreground bg-foreground'
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                      aria-label={`${row} — ${col}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {requiredError && (
        <p className="text-sm text-destructive" role="alert">Ce champ est requis</p>
      )}
    </div>
  );
}

function FirstImpressionBlock({ config, value, onChange }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const duration = Number(config.duration ?? 5);
  const imageUrl = String(config.imageUrl || '');
  const instructions = String(config.instructions || '');
  const [phase, setPhase] = useState<'instructions' | 'showing' | 'done'>('instructions');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startShowing() {
    setPhase('showing');
    timerRef.current = setTimeout(() => {
      setPhase('done');
      onChange('seen');
    }, duration * 1000);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // If already completed (value = 'seen'), go straight to done
  useEffect(() => {
    if (value === 'seen') setPhase('done');
  }, [value]);

  return (
    <div className="space-y-4">
      {phase === 'instructions' && (
        <>
          {instructions && (
            <p className="text-lg text-foreground leading-relaxed">{instructions}</p>
          )}
          <button
            type="button"
            onClick={startShowing}
            className="px-6 py-2.5 bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Voir l'image ({duration} s)
          </button>
        </>
      )}

      {phase === 'showing' && imageUrl && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Premier regard"
            className="max-w-full rounded-lg border border-border"
          />
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
            {duration} s
          </div>
        </div>
      )}

      {phase === 'done' && (
        <p className="text-sm text-muted-foreground italic">
          L'image a disparu. Répondez aux questions suivantes.
        </p>
      )}
    </div>
  );
}

// ─── Prototype task helpers (mirrored from PreviewModal) ─────────────────────

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

function extractFigmaNodeId(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const nodeId = u.searchParams.get('node-id') ?? '';
    return nodeId.replace(/-/g, ':');
  } catch { return ''; }
}

interface PrototypeNavigation { nodeId: string; at: number }

interface PrototypeResult {
  completed: boolean;
  skipped: boolean;
  timeOnTask: number | null;
  goalReached: boolean;
  navigations: PrototypeNavigation[];
  /** True when the participant clicked "J'ai terminé" instead of auto-detection */
  manualCompletion?: boolean;
}

function PrototypeTaskBlock({ config, value, onChange }: {
  config: Record<string, unknown>;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const url = String(config.url || '');
  const instructions = String(config.instructions || '');
  const taskType = String(config.taskType || 'explore');
  const goalFrameUrl = String(config.goalFrameUrl || '');
  // Prefer the direct goalNodeId from the screen picker; fall back to parsing goalFrameUrl
  const goalNodeId = config.goalNodeId
    ? String(config.goalNodeId)
    : extractFigmaNodeId(goalFrameUrl);
  const isGoalBased = Boolean(taskType === 'goal' && goalNodeId);
  const embedUrl = toFigmaEmbedUrl(url);

  type Phase = 'instructions' | 'running' | 'done' | 'error';
  const [phase, setPhase] = useState<Phase>('instructions');
  const [goalReached, setGoalReached] = useState(false);
  const [navigations, setNavigations] = useState<PrototypeNavigation[]>([]);
  const startedAtRef = useRef<number | null>(null);

  // If already responded (resumed session), go to done
  useEffect(() => {
    if (value && typeof value === 'object' && (value as PrototypeResult).completed) {
      setPhase('done');
    }
  }, [value]);

  // postMessage listener for Figma navigation events
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

      const nav: PrototypeNavigation = { nodeId: normalizedId, at: Date.now() };
      setNavigations((prev) => [...prev, nav]);

      if (isGoalBased && (normalizedId === goalNodeId || rawId === goalNodeId)) {
        setGoalReached(true);
        completeTask(true, [...navigations, nav]);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, goalNodeId, isGoalBased, navigations]);

  function completeTask(goalReachedFlag: boolean, navList: PrototypeNavigation[]) {
    const timeOnTask = startedAtRef.current ? Date.now() - startedAtRef.current : null;
    const result: PrototypeResult = {
      completed: true,
      skipped: false,
      timeOnTask,
      goalReached: goalReachedFlag,
      navigations: navList,
    };
    onChange(result);
    setPhase('done');
  }

  function handleManualComplete() {
    const timeOnTask = startedAtRef.current ? Date.now() - startedAtRef.current : null;
    const result: PrototypeResult = {
      completed: true,
      skipped: false,
      timeOnTask,
      goalReached: false,
      manualCompletion: true,
      navigations,
    };
    onChange(result);
    setGoalReached(true); // show the success overlay
    setTimeout(() => setPhase('done'), 1200); // brief pause so user sees the overlay
  }

  function handleSkip() {
    const result: PrototypeResult = {
      completed: false,
      skipped: true,
      timeOnTask: startedAtRef.current ? Date.now() - startedAtRef.current : null,
      goalReached: false,
      navigations,
    };
    onChange(result);
    setPhase('done');
  }

  function handleIframeLoad() {
    startedAtRef.current = Date.now();
    setPhase('running');
  }

  function handleIframeError() {
    setPhase('error');
  }

  // ── Instructions phase ──
  if (phase === 'instructions') {
    return (
      <div className="space-y-6">
        {instructions && (
          <p className="text-lg text-foreground leading-relaxed">{instructions}</p>
        )}
        {!url && (
          <p className="text-sm text-destructive">Aucun prototype configuré pour cette tâche.</p>
        )}
        {url && (
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

  // ── Error phase ──
  if (phase === 'error') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base text-foreground">Le prototype n'a pas pu se charger.</p>
        <p className="text-sm text-muted-foreground">
          Vérifiez votre connexion ou réessayez.
        </p>
        <button
          type="button"
          onClick={handleSkip}
          className="px-6 py-2.5 border border-border text-foreground text-sm rounded-lg hover:bg-muted transition-colors"
        >
          Passer la tâche
        </button>
      </div>
    );
  }

  // ── Done phase ──
  if (phase === 'done') {
    const result = value as PrototypeResult | null;
    return (
      <div className="text-center space-y-3">
        {result?.skipped ? (
          <p className="text-base text-muted-foreground">Tâche passée.</p>
        ) : (
          <>
            <div className="text-4xl">✅</div>
            <p className="text-lg font-semibold text-foreground">Tâche terminée !</p>
            {result?.timeOnTask && (
              <p className="text-sm text-muted-foreground">
                Temps : {Math.round(result.timeOnTask / 1000)} secondes
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Running phase (iframe + overlay if goal reached) ──
  return (
    <div className="space-y-4">
      <div className="relative w-full" style={{ height: '70vh' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <iframe
          src={embedUrl}
          className="w-full h-full rounded-lg border border-border"
          title="Prototype"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allow="fullscreen"
        />
        {goalReached && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="bg-background rounded-xl p-8 text-center space-y-3 max-w-xs shadow-xl">
              <div className="text-4xl">✅</div>
              <p className="text-lg font-semibold text-foreground">Tâche complétée !</p>
              <p className="text-sm text-muted-foreground">
                Vous avez atteint l'écran cible.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
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

function ContentBlock({ config }: { config: Record<string, unknown> }) {
  const title = String(config.title || '');
  const body = String(config.body || '');
  return (
    <div className="space-y-3">
      {title && <h2 className="text-2xl font-semibold text-foreground">{title}</h2>}
      {body && <p className="text-base text-muted-foreground leading-relaxed">{body}</p>}
    </div>
  );
}

// ─── Anchor block renderers ───────────────────────────────────────────────────

function WelcomeBlock({ config, onNext }: {
  config: Record<string, unknown>;
  onNext?: () => void;
}) {
  const title = String(config.title || 'Bienvenue');
  const description = String(config.description || '');
  const buttonText = String(config.buttonText || 'Commencer');

  return (
    <div className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-foreground leading-tight">{title}</h1>
      {description && (
        <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
          {description}
        </p>
      )}
      <button
        type="button"
        onClick={onNext}
        className="px-8 py-3 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {buttonText}
      </button>
    </div>
  );
}

function ThankYouBlock({ config }: { config: Record<string, unknown> }) {
  const title = String(config.title || 'Merci !');
  const description = String(config.description || 'Vos réponses ont bien été enregistrées.');

  return (
    <div className="text-center space-y-4" role="status" aria-live="polite">
      <div className="text-5xl mb-2">🎉</div>
      <h1 className="text-3xl font-bold text-foreground leading-tight">{title}</h1>
      {description && (
        <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
          {description}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParticipantBlock({ block, value, onChange, onNext, requiredError }: ParticipantBlockProps) {
  const config = block.config as Record<string, unknown>;

  switch (block.blockType) {
    case 'welcome':
      return <WelcomeBlock config={config} onNext={onNext} />;
    case 'thank_you':
      return <ThankYouBlock config={config} />;
    case 'short_text':
      return <ShortTextBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'long_text':
      return <LongTextBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'mcq':
      return <McqBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'likert':
      return <LikertBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'rating':
      return <RatingBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'nps':
      return <NpsBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'card_sort':
      return <CardSortBlock config={config} value={value} onChange={onChange} />;
    case 'matrix':
      return <MatrixBlock config={config} value={value} onChange={onChange} requiredError={requiredError} />;
    case 'first_impression':
      return <FirstImpressionBlock config={config} value={value} onChange={onChange} />;
    case 'content':
      return <ContentBlock config={config} />;
    case 'prototype_task':
      return <PrototypeTaskBlock config={config} value={value} onChange={onChange} />;
    default:
      return null;
  }
}
