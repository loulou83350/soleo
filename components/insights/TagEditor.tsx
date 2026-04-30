'use client';

import { useState, useTransition, useRef, useEffect, type FormEvent } from 'react';
import { Plus, Sparkles, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { TagChip, TAG_PALETTE, getTagColorClasses } from './TagChip';
import {
  createTagAction,
  attachTagAction,
  detachTagAction,
  suggestTagsAction,
  acceptSuggestedTagAction,
  revalidateParticipantPath,
} from '@/app/(dashboard)/dashboard/projects/[id]/sessions/[sessionId]/participants/[participantToken]/actions';
import type { InsightTag, TagSource } from '@/lib/db/schema';
import type { AIProvider, TagSuggestion } from '@/lib/ai/providers';

interface AttachedTag {
  tag: InsightTag;
  source: TagSource;
}

interface TagEditorProps {
  responseId: number;
  /** Tags currently attached to this response */
  initialAttached: AttachedTag[];
  /** Full team library — for autocomplete on add */
  teamTags: InsightTag[];
  /** Available AI providers (anthropic, gemini) — empty array hides AI button */
  availableProviders: AIProvider[];
  /** Default provider (from env) */
  activeProvider: AIProvider | null;
  /** Path-revalidation context — passed to actions on success */
  context: {
    projectId: number;
    sessionId: number;
    participantToken: string;
  };
}

export function TagEditor({
  responseId,
  initialAttached,
  teamTags,
  availableProviders,
  activeProvider,
  context,
}: TagEditorProps) {
  const [attached, setAttached] = useState<AttachedTag[]>(initialAttached);
  const [allTeamTags, setAllTeamTags] = useState<InsightTag[]>(teamTags);
  const [isPending, startTransition] = useTransition();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pickerColor, setPickerColor] = useState('gray');

  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(activeProvider);

  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside → close picker
  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [pickerOpen]);

  const attachedIds = new Set(attached.map((a) => a.tag.id));
  const availableTags = allTeamTags.filter((t) => !attachedIds.has(t.id));
  const filtered = search
    ? availableTags.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()))
    : availableTags;
  const exactMatch = allTeamTags.some(
    (t) => t.label.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = search.trim().length > 0 && !exactMatch;

  // ─── Mutations ─────────────────────────────────────────────────────────────

  function refreshPath() {
    void revalidateParticipantPath(
      context.projectId,
      context.sessionId,
      context.participantToken
    );
  }

  function attachExistingTag(tag: InsightTag, source: TagSource = 'manual') {
    // Optimistic
    setAttached((prev) => [...prev, { tag, source }]);
    setSearch('');
    setPickerOpen(false);
    startTransition(async () => {
      const res = await attachTagAction(responseId, tag.id);
      if (!res.success) {
        // rollback
        setAttached((prev) => prev.filter((a) => a.tag.id !== tag.id));
      } else {
        refreshPath();
      }
    });
  }

  function detachExistingTag(tagId: number) {
    const prev = attached;
    setAttached((cur) => cur.filter((a) => a.tag.id !== tagId));
    startTransition(async () => {
      const res = await detachTagAction(responseId, tagId);
      if (!res.success) setAttached(prev);
      else refreshPath();
    });
  }

  function createAndAttach() {
    const label = search.trim();
    if (!label) return;
    startTransition(async () => {
      const res = await createTagAction(label, pickerColor);
      if (!res.success || !res.data) {
        return;
      }
      const tag = res.data.tag;
      setAllTeamTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      // Now attach
      setAttached((cur) => [...cur, { tag, source: 'manual' }]);
      setSearch('');
      setPickerOpen(false);
      const a = await attachTagAction(responseId, tag.id);
      if (!a.success) {
        setAttached((cur) => cur.filter((x) => x.tag.id !== tag.id));
      } else {
        refreshPath();
      }
    });
  }

  // ─── AI suggest ────────────────────────────────────────────────────────────

  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestError(null);
    setSuggestions([]);
    const res = await suggestTagsAction(responseId, provider ?? undefined);
    setSuggestLoading(false);
    if (!res.success || !res.data) {
      setSuggestError(res.success ? null : (res.error ?? 'Erreur'));
      return;
    }
    // Filter out suggestions that are already attached
    const attachedLabels = new Set(
      attached.map((a) => a.tag.label.toLowerCase())
    );
    const fresh = res.data.suggestions.filter(
      (s) => !attachedLabels.has(s.label.toLowerCase())
    );
    setSuggestions(fresh);
  }

  function acceptSuggestion(s: TagSuggestion) {
    // Pick a deterministic color based on the label (so the same label always
    // gets the same color until the user customizes it)
    const color = pickColorForLabel(s.label);
    startTransition(async () => {
      const res = await acceptSuggestedTagAction(responseId, s.label, color);
      if (!res.success || !res.data) return;
      const tag = res.data.tag;
      setAllTeamTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
      );
      setAttached((cur) => [
        ...cur,
        { tag, source: 'ai_suggested' as TagSource },
      ]);
      setSuggestions((prev) => prev.filter((x) => x.label !== s.label));
      refreshPath();
    });
  }

  function dismissSuggestion(label: string) {
    setSuggestions((prev) => prev.filter((s) => s.label !== label));
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (canCreate) createAndAttach();
    else if (filtered.length > 0) attachExistingTag(filtered[0]);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="space-y-2">
      {/* Attached tags + add button + suggest button */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {attached.map(({ tag, source }) => (
          <TagChip
            key={tag.id}
            label={tag.label}
            color={tag.color}
            source={source}
            onRemove={() => detachExistingTag(tag.id)}
          />
        ))}

        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 border border-dashed border-border rounded-full text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Tag
        </button>

        {availableProviders.length > 0 && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggestLoading}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 border border-border rounded-full text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors disabled:opacity-50"
          >
            {suggestLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Suggérer
          </button>
        )}

        {/* Provider toggle — only shows when both keys are configured */}
        {availableProviders.length > 1 && (
          <ProviderToggle
            value={provider ?? availableProviders[0]}
            onChange={setProvider}
            options={availableProviders}
          />
        )}
      </div>

      {/* AI suggestions waiting for review */}
      {suggestError && (
        <p className="text-xs text-destructive">{suggestError}</p>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Suggestions IA — cliquez pour accepter
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => acceptSuggestion(s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  dismissSuggestion(s.label);
                }}
                title="Clic gauche : accepter · clic droit : ignorer"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border"
              >
                <Sparkles className="h-3 w-3" />
                {s.label}
                {s.isNew && (
                  <span className="text-[10px] uppercase tracking-wide opacity-70">
                    nouveau
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picker popover */}
      {pickerOpen && (
        <div className="border border-border rounded-lg bg-background shadow-md p-3 space-y-3 max-w-sm">
          <form onSubmit={handleCreateSubmit} className="space-y-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher ou créer un tag…"
              autoFocus
              className="w-full text-sm px-2 py-1.5 border border-border rounded focus:outline-none focus:ring-1 focus:ring-foreground/30 bg-background text-foreground"
            />
          </form>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => attachExistingTag(tag)}
                disabled={isPending}
                className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${getTagColorClasses(tag.color).split(' ')[0]}`}
                />
                <span className="text-sm text-foreground">{tag.label}</span>
              </button>
            ))}
            {canCreate && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground px-2">Créer le tag</p>
                <div className="flex items-center gap-1 px-2 flex-wrap">
                  {TAG_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPickerColor(c)}
                      className={`h-5 w-5 rounded-full ${getTagColorClasses(c).split(' ')[0]} ring-2 ring-offset-1 ring-offset-background transition-all ${pickerColor === c ? 'ring-foreground/40' : 'ring-transparent'}`}
                      aria-label={c}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={createAndAttach}
                  disabled={isPending}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Créer &laquo; {search.trim()} &raquo;
                </button>
              </div>
            )}
            {!canCreate && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Aucun tag ne correspond.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Provider toggle (compact dropdown) ──────────────────────────────────────

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

// ─── Color picker logic ──────────────────────────────────────────────────────

const SUGGESTED_COLORS = [
  'blue',
  'green',
  'purple',
  'orange',
  'pink',
  'teal',
  'red',
  'yellow',
  'indigo',
];

function pickColorForLabel(label: string): string {
  // Deterministic hash → color
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return SUGGESTED_COLORS[Math.abs(hash) % SUGGESTED_COLORS.length];
}
