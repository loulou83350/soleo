'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';

/**
 * Story 6.3 — Soft upgrade CTA on the public findings viewer.
 * Appears once the visitor scrolls past 50% of the page.
 * Dismissible via the X button (state held in sessionStorage so it
 * doesn't reappear on the same tab during a single visit).
 */
export function UpgradePrompt() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDismissed = sessionStorage.getItem('soleo_upgrade_dismissed') === '1';
    setDismissed(isDismissed);
  }, []);

  // Show when sentinel (placed near 50% of content) enters viewport
  useEffect(() => {
    if (dismissed) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dismissed]);

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('soleo_upgrade_dismissed', '1');
    }
  }

  return (
    <>
      {/* Sentinel placed at the bottom of main — triggers the prompt */}
      <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />

      {visible && !dismissed && (
        <div
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-30 animate-in slide-in-from-bottom-4 duration-300"
          role="region"
          aria-label="Découvrir Soleo"
        >
          <div className="relative rounded-xl border border-border bg-background shadow-lg p-5 pr-10">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fermer"
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-lg bg-foreground text-background flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Vous voulez créer le vôtre ?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Soleo vous aide à collecter, analyser et partager vos études
                  utilisateurs en quelques minutes — avec citations sourcées.
                </p>
                <a
                  href="/?utm_source=findings_prompt"
                  className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-foreground hover:underline"
                >
                  Découvrir Soleo
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
