'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, BookOpen, Flag, Star } from 'lucide-react';
import type { SessionWithPages, SessionBlock } from '@/lib/db/schema';
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
      const items = Array.isArray(cfg.items) ? cfg.items as Array<{ label: string; imageUrl?: string }> : [];
      return (
        <div>
          <QuestionHeader />
          <div className="flex gap-2 flex-wrap">
            {items.map((item, i) => (
              <div
                key={i}
                className="border border-border rounded-lg p-3 bg-background text-sm text-foreground cursor-grab active:cursor-grabbing hover:border-foreground/30 transition-colors"
              >
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-16 w-24 object-cover rounded mb-1.5" />
                )}
                {item.label || `Carte ${i + 1}`}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground italic">
            (Le tri interactif est disponible en mode participant)
          </p>
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

    case 'prototype_task': {
      const url          = typeof cfg.url          === 'string' ? cfg.url          : '';
      const instructions = typeof cfg.instructions === 'string' ? cfg.instructions : '';

      return (
        <div>
          <QuestionHeader />
          {instructions && <p className="text-sm text-muted-foreground mb-3">{instructions}</p>}
          {url ? (
            <div className="border border-border rounded-lg overflow-hidden" style={{ height: 480 }}>
              <iframe
                src={url}
                className="w-full h-full"
                title="Prototype"
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">URL du prototype non définie</p>
            </div>
          )}
        </div>
      );
    }

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
  session: SessionWithPages;
  onClose: () => void;
}

export function PreviewModal({ session, onClose }: PreviewModalProps) {
  const questionPages = session.pages.filter((p) => p.pageType !== 'intro' && p.pageType !== 'end');
  const introPage = session.pages.find((p) => p.pageType === 'intro');
  const endPage   = session.pages.find((p) => p.pageType === 'end');

  // All pages in order: intro (virtual) + question pages + end (virtual)
  const allPages = [
    ...(introPage ? [{ id: introPage.id, pageType: 'intro' as const, title: 'Introduction' }] : []),
    ...questionPages.map((p) => ({ id: p.id, pageType: 'question' as const, title: p.title })),
    ...(endPage ? [{ id: endPage.id, pageType: 'end' as const, title: 'Fin' }] : []),
  ];

  const [pageIdx, setPageIdx] = useState(0);
  const [responses, setResponses] = useState<Map<number, unknown>>(new Map());

  const currentPageMeta = allPages[pageIdx];
  const currentPage = currentPageMeta?.pageType === 'question'
    ? session.pages.find((p) => p.id === currentPageMeta.id)
    : null;

  const visibleBlocks = currentPage
    ? currentPage.blocks.filter((b) => isBlockVisible(b, responses))
    : [];

  function setResponse(blockId: number, value: unknown) {
    setResponses((prev) => new Map(prev).set(blockId, value));
  }

  function goNext() {
    if (pageIdx < allPages.length - 1) setPageIdx((i) => i + 1);
  }
  function goPrev() {
    if (pageIdx > 0) setPageIdx((i) => i - 1);
  }

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isFirst = pageIdx === 0;
  const isLast  = pageIdx === allPages.length - 1;

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
            Page {pageIdx + 1} / {allPages.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {allPages.map((_, i) => (
            <button
              key={i}
              onClick={() => setPageIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === pageIdx ? 'w-6 bg-foreground' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
              aria-label={`Aller à la page ${i + 1}`}
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

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

          {currentPageMeta?.pageType === 'intro' && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground mb-2">{session.title}</h1>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Bienvenue ! Merci de prendre quelques minutes pour répondre à cette session de recherche.
                </p>
              </div>
            </div>
          )}

          {currentPageMeta?.pageType === 'end' && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Flag className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground mb-2">Merci !</h1>
                <p className="text-sm text-muted-foreground">Vous avez complété la session.</p>
              </div>
            </div>
          )}

          {currentPageMeta?.pageType === 'question' && (
            <>
              {visibleBlocks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center italic py-8">
                  Aucun bloc visible sur cette page (conditions non remplies).
                </p>
              )}
              {visibleBlocks.map((block) => (
                <PreviewBlock
                  key={block.id}
                  block={block}
                  responses={responses}
                  onResponse={setResponse}
                />
              ))}
            </>
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
          {currentPageMeta?.title}
        </span>

        <button
          onClick={isLast ? onClose : goNext}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 transition-opacity"
        >
          {isLast ? 'Fermer' : 'Suivant'}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
