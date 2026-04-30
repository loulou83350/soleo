'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { CitationSource } from '@/components/findings/CitationPill';

interface Props {
  open: boolean;
  /** Available citation sources, keyed by responseId */
  sources: Map<number, CitationSource>;
  /** Triggered when the user picks a source */
  onPick: (responseId: number) => void;
  onClose: () => void;
}

export function CitationPicker({ open, sources, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Focus the search input when opened
      setQuery('');
      setHighlightIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Build a flat, ordered list grouped by question
  const grouped = useMemo(() => {
    type Group = { question: string; entries: CitationSource[] };
    const map = new Map<string, Group>();
    for (const src of sources.values()) {
      if (!src.text.trim()) continue;
      const key = src.question || '(sans question)';
      if (!map.has(key)) map.set(key, { question: key, entries: [] });
      map.get(key)!.entries.push(src);
    }
    // Filter by query
    const q = query.trim().toLowerCase();
    const result: Group[] = [];
    for (const g of map.values()) {
      const filtered = q
        ? g.entries.filter(
            (e) =>
              e.text.toLowerCase().includes(q) ||
              g.question.toLowerCase().includes(q) ||
              `#${e.participantNumber}`.includes(q)
          )
        : g.entries;
      if (filtered.length > 0) result.push({ question: g.question, entries: filtered });
    }
    return result;
  }, [sources, query]);

  // Flatten for keyboard nav
  const flat = useMemo(() => grouped.flatMap((g) => g.entries), [grouped]);

  useEffect(() => setHighlightIdx(0), [flat.length]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % Math.max(flat.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => (i + flat.length - 1) % Math.max(flat.length, 1));
      } else if (e.key === 'Enter') {
        const target = flat[highlightIdx];
        if (target) {
          e.preventDefault();
          onPick(target.responseId);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, flat, highlightIdx, onPick, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-background border border-border rounded-xl shadow-xl flex flex-col max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans les réponses, par texte ou #numéro…"
            className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Aucune réponse ne correspond.
            </p>
          ) : (
            grouped.map((g) => (
              <div key={g.question}>
                <p className="sticky top-0 bg-muted/40 backdrop-blur px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
                  {g.question}
                </p>
                <ul>
                  {g.entries.map((src) => {
                    const idx = flat.indexOf(src);
                    const isActive = idx === highlightIdx;
                    return (
                      <li key={src.responseId}>
                        <button
                          type="button"
                          onMouseEnter={() => setHighlightIdx(idx)}
                          onClick={() => onPick(src.responseId)}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/30 transition-colors ${
                            isActive ? 'bg-muted' : 'hover:bg-muted/40'
                          }`}
                        >
                          <span className="shrink-0 inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 tabular-nums">
                            #{src.participantNumber}
                          </span>
                          <span className="text-sm text-foreground line-clamp-3 flex-1">
                            {src.text || (
                              <em className="text-muted-foreground">(réponse vide)</em>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ Naviguer · Entrée pour insérer · Échap pour fermer</span>
          <span className="tabular-nums">
            {flat.length} réponse{flat.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
