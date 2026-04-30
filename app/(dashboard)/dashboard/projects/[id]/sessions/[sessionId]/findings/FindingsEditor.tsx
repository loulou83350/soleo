'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Check, Copy, Globe, Lock, ExternalLink, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Editor as RichEditor } from '@/components/findings/editor/Editor';
import type { CitationSource } from '@/components/findings/CitationPill';
import {
  saveFindingAction,
  generateFindingDraftAction,
  publishFindingAction,
  unpublishFindingAction,
  revalidateFindingPath,
} from './actions';
import type { SessionFinding } from '@/lib/db/schema';
import type { AIProvider } from '@/lib/ai/providers';
import { track } from '@/lib/analytics/track';

interface Props {
  finding: SessionFinding;
  /** Citation sources serialized as [responseId, source][] tuples */
  sources: Array<[number, CitationSource]>;
  availableProviders: AIProvider[];
  activeProvider: AIProvider | null;
  context: { projectId: number; sessionId: number };
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function FindingsEditor({
  finding,
  sources: sourcesEntries,
  availableProviders,
  activeProvider,
  context,
}: Props) {
  const sources = new Map(sourcesEntries);
  const [title, setTitle] = useState(finding.title);
  const [body, setBody] = useState(finding.bodyMarkdown);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isPublished, setIsPublished] = useState(finding.isPublished);
  const [publicToken, setPublicToken] = useState<string | null>(finding.publicToken);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(activeProvider);

  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // ─── Auto-save title + body (debounced 1s) ────────────────────────────────

  useEffect(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus('saving');
    debounceRef.current = setTimeout(async () => {
      const res = await saveFindingAction(finding.id, {
        title,
        bodyMarkdown: body,
      });
      setSaveStatus(res.success ? 'saved' : 'error');
      if (res.success) setTimeout(() => setSaveStatus('idle'), 1500);
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  // ─── AI generation ────────────────────────────────────────────────────────

  async function handleGenerate() {
    // Confirm before overwriting existing content
    if (body.trim().length > 0) {
      const ok = window.confirm(
        'Remplacer le contenu actuel par un nouveau brouillon généré par l\'IA ?'
      );
      if (!ok) return;
    }
    setGenerating(true);
    setGenError(null);
    const res = await generateFindingDraftAction(
      context.sessionId,
      provider ?? undefined
    );
    setGenerating(false);
    if (!res.success || !res.data) {
      setGenError(res.success ? null : (res.error ?? 'Erreur'));
      return;
    }
    track('findings_ai_generated', {
      session_id: context.sessionId,
      provider: provider ?? null,
    });
    setBody(res.data.markdown);
    // Skip the next debounced save (the action already saved)
    dirtyRef.current = false;
  }

  // ─── Publish / unpublish ──────────────────────────────────────────────────

  function handlePublish() {
    startTransition(async () => {
      const res = await publishFindingAction(finding.id);
      if (res.success && res.data) {
        track('findings_published', { session_id: context.sessionId });
        setIsPublished(true);
        setPublicToken(res.data.token);
        revalidateFindingPath(context.projectId, context.sessionId);
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      const res = await unpublishFindingAction(finding.id);
      if (res.success) {
        setIsPublished(false);
        revalidateFindingPath(context.projectId, context.sessionId);
      }
    });
  }

  // ─── Copy public link ─────────────────────────────────────────────────────

  async function handleCopyLink() {
    if (!publicToken) return;
    const url = `${window.location.origin}/findings/${publicToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasBody = body.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: save status only */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {saveStatus === 'saving' && 'Enregistrement…'}
          {saveStatus === 'saved' && '✓ Enregistré'}
          {saveStatus === 'error' && (
            <span className="text-destructive">Erreur de sauvegarde</span>
          )}
          {saveStatus === 'idle' && (
            <span className="text-muted-foreground/60">Auto-save activé</span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {/* AI assist — secondary, ghost button */}
          {availableProviders.length > 0 && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleGenerate}
                disabled={generating}
                className="text-muted-foreground hover:text-foreground"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {hasBody ? 'Régénérer avec l’IA' : 'Suggérer un brouillon IA'}
                  </>
                )}
              </Button>
              {availableProviders.length > 1 && (
                <ProviderToggle
                  value={provider ?? availableProviders[0]}
                  onChange={setProvider}
                  options={availableProviders}
                />
              )}
              <span className="h-5 w-px bg-border mx-1" aria-hidden />
            </>
          )}


          {isPublished && publicToken && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copier le lien
                </>
              )}
            </Button>
          )}
          {isPublished && publicToken && (
            <Button type="button" size="sm" variant="outline" asChild>
              <a
                href={`/findings/${publicToken}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Voir public
              </a>
            </Button>
          )}
          {isPublished ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUnpublish}
              disabled={isPending}
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Dépublier
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handlePublish}
              disabled={isPending || !hasBody}
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Publier
            </Button>
          )}
        </div>
      </div>

      {genError && (
        <div className="border border-destructive/30 bg-destructive/5 text-destructive text-sm rounded-md px-3 py-2">
          {genError}
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du rapport…"
        className="w-full text-2xl font-semibold border-0 border-b border-border focus:border-foreground/40 focus:outline-none bg-transparent py-2 transition-colors placeholder:text-muted-foreground/50"
      />

      {/* Notion-style block editor (Story 6.4) */}
      <div className="border border-border rounded-lg p-6 min-h-[65vh] bg-background">
        <RichEditor
          initialMarkdown={body}
          sources={sources}
          sessionId={context.sessionId}
          onChange={(md) => setBody(md)}
          placeholder={
            availableProviders.length > 0
              ? 'Tapez "/" pour ouvrir le menu de commandes (titres, listes, citations…), ou ✨ pour générer un brouillon avec l\'IA.'
              : 'Tapez "/" pour ouvrir le menu de commandes (titres, listes, citations…).'
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Tapez <code className="px-1 py-0.5 bg-muted rounded text-[11px]">/</code>{' '}
        n&apos;importe où pour insérer un titre, une liste, ou citer une
        réponse via le picker. Les citations apparaissent inline comme des
        pills cliquables.{' '}
        {isPublished && publicToken && (
          <a
            href={`/findings/${publicToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Voir le rendu public →
          </a>
        )}
      </p>
    </div>
  );
}

// ─── Provider toggle ─────────────────────────────────────────────────────────

function ProviderToggle({
  value,
  onChange,
  options,
}: {
  value: AIProvider;
  onChange: (p: AIProvider) => void;
  options: AIProvider[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {value} <ChevronsUpDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-10 right-0 top-6 border border-border bg-background rounded-md shadow-md py-1 min-w-[120px]">
          {options.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 text-xs px-2 py-1 hover:bg-muted"
            >
              {p}
              {p === value && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
