'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignLeft, AlignJustify, CheckSquare, BarChart2, Star,
  Gauge, LayoutGrid, Table2, Eye, Play, Type,
  Plus, Trash2, Check, Loader2, AlertCircle, Upload, GitBranch, X,
} from 'lucide-react';
import type { SessionBlock, SessionPageWithBlocks, BlockType } from '@/lib/db/schema';
import type {
  ContentConfig, ShortTextConfig, LongTextConfig, McqConfig, LikertConfig,
  RatingConfig, NpsConfig, CardSortConfig, MatrixConfig,
  FirstImpressionConfig, PrototypeTaskConfig,
} from '@/lib/domain/blocks';
import { BLOCK_LABELS } from '@/lib/domain/blocks';
import type { BlockCondition, BlockVisibilityRule, ConditionOperator } from '@/lib/domain/types';
import { updateBlockAction, deleteBlockAction, uploadBlockImageAction } from '@/app/(dashboard)/dashboard/projects/[id]/sessions/actions';

// ─── Shared field components ──────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-foreground mb-1">{children}</label>
  );
}

function TextInput({
  value, onChange, placeholder, multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls = 'w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none';
  if (multiline) {
    return (
      <textarea
        className={cls}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type="text"
      className={cls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Toggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-foreground/30 ${
          checked ? 'bg-foreground' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function RadioGroup<T extends string | number>({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              value === opt.value
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Image upload widget ───────────────────────────────────────────────────────

function ImageUpload({
  sessionId, imageUrl, onUploaded, label = 'Image',
}: {
  sessionId: number;
  imageUrl: string;
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadBlockImageAction(sessionId, fd);
    setUploading(false);
    if (result.success) {
      onUploaded(result.data.url);
    } else {
      setError(result.error ?? 'Erreur upload');
    }
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Aperçu"
            className="h-16 w-24 object-cover rounded-md border border-border cursor-pointer"
            onClick={() => inputRef.current?.click()}
            title="Cliquer pour remplacer"
          />
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="h-16 w-24 border-2 border-dashed border-border rounded-md flex items-center justify-center cursor-pointer hover:border-foreground/40 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {uploading ? 'Upload en cours…' : imageUrl ? 'Remplacer' : 'Choisir une image'}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Type-specific forms ──────────────────────────────────────────────────────

function ContentForm({ config, onChange }: { config: ContentConfig; onChange: (c: ContentConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Titre (optionnel)</Label>
        <TextInput
          value={config.title}
          onChange={(v) => onChange({ ...config, title: v })}
          placeholder="Titre de section…"
        />
      </div>
      <div>
        <Label>Corps du texte</Label>
        <TextInput
          value={config.body}
          onChange={(v) => onChange({ ...config, body: v })}
          placeholder="Ajoutez des instructions, un contexte, une description…"
          multiline
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Ce bloc affiche du texte au participant sans attendre de réponse.
        </p>
      </div>
    </div>
  );
}

function ShortTextForm({ config, onChange }: { config: ShortTextConfig; onChange: (c: ShortTextConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <div>
        <Label>Placeholder</Label>
        <TextInput value={config.placeholder} onChange={(v) => onChange({ ...config, placeholder: v })} placeholder="Ex: Votre réponse ici…" />
      </div>
    </div>
  );
}

function LongTextForm({ config, onChange }: { config: LongTextConfig; onChange: (c: LongTextConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <div>
        <Label>Placeholder</Label>
        <TextInput value={config.placeholder} onChange={(v) => onChange({ ...config, placeholder: v })} placeholder="Ex: Décrivez en détail…" />
      </div>
      <div className="border-t border-border pt-3">
        <Toggle
          label="Suivi IA (Épique 7)"
          checked={config.aiFollowUp}
          onChange={(v) => onChange({ ...config, aiFollowUp: v })}
        />
        {config.aiFollowUp && (
          <div className="mt-3">
            <RadioGroup
              label="Nombre max de relances"
              options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }]}
              value={config.maxTurns}
              onChange={(v) => onChange({ ...config, maxTurns: v as 1 | 2 | 3 })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function McqForm({ config, onChange }: { config: McqConfig; onChange: (c: McqConfig) => void }) {
  function updateOption(idx: number, value: string) {
    const options = [...config.options];
    options[idx] = value;
    onChange({ ...config, options });
  }
  function addOption() {
    if (config.options.length >= 10) return;
    onChange({ ...config, options: [...config.options, ''] });
  }
  function removeOption(idx: number) {
    if (config.options.length <= 2) return;
    const options = config.options.filter((_, i) => i !== idx);
    onChange({ ...config, options });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <div>
        <Label>Options ({config.options.length}/10)</Label>
        <div className="space-y-1.5">
          {config.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextInput value={opt} onChange={(v) => updateOption(idx, v)} placeholder={`Option ${idx + 1}`} />
              {config.options.length > 2 && (
                <button onClick={() => removeOption(idx)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {config.options.length < 10 && (
          <button onClick={addOption} className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3 w-3" /> Ajouter une option
          </button>
        )}
      </div>
      <div className="border-t border-border pt-3 space-y-1">
        <Toggle label="Réponse multiple" checked={config.allowMultiple} onChange={(v) => onChange({ ...config, allowMultiple: v })} />
        <Toggle label="Randomiser l'ordre" checked={config.randomize} onChange={(v) => onChange({ ...config, randomize: v })} />
        <Toggle label='Option "Autre"' checked={config.allowOther} onChange={(v) => onChange({ ...config, allowOther: v })} />
      </div>
    </div>
  );
}

function LikertForm({ config, onChange }: { config: LikertConfig; onChange: (c: LikertConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <RadioGroup
        label="Échelle"
        options={[{ value: 3, label: '3 points' }, { value: 5, label: '5 points' }, { value: 7, label: '7 points' }]}
        value={config.scale}
        onChange={(v) => onChange({ ...config, scale: v as 3 | 5 | 7 })}
      />
      <div>
        <Label>Étiquette gauche</Label>
        <TextInput value={config.lowLabel} onChange={(v) => onChange({ ...config, lowLabel: v })} placeholder="Ex: Pas du tout d'accord" />
      </div>
      <div>
        <Label>Étiquette droite</Label>
        <TextInput value={config.highLabel} onChange={(v) => onChange({ ...config, highLabel: v })} placeholder="Ex: Tout à fait d'accord" />
      </div>
    </div>
  );
}

function RatingForm({ config, onChange }: { config: RatingConfig; onChange: (c: RatingConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <RadioGroup
        label="Maximum"
        options={[{ value: 5, label: '5 étoiles' }, { value: 10, label: '10 étoiles' }]}
        value={config.max}
        onChange={(v) => onChange({ ...config, max: v as 5 | 10 })}
      />
    </div>
  );
}

function NpsForm({ config, onChange }: { config: NpsConfig; onChange: (c: NpsConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Quelle est la probabilité que vous recommandiez…" multiline />
      </div>
      <div>
        <Label>Étiquette 0 (gauche)</Label>
        <TextInput value={config.lowLabel} onChange={(v) => onChange({ ...config, lowLabel: v })} placeholder="Ex: Pas du tout probable" />
      </div>
      <div>
        <Label>Étiquette 10 (droite)</Label>
        <TextInput value={config.highLabel} onChange={(v) => onChange({ ...config, highLabel: v })} placeholder="Ex: Très probable" />
      </div>
    </div>
  );
}

function CardSortForm({ config, onChange, sessionId }: { config: CardSortConfig; onChange: (c: CardSortConfig) => void; sessionId: number }) {
  function updateItem(idx: number, field: 'label' | 'imageUrl', value: string) {
    const items = config.items.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    onChange({ ...config, items });
  }
  function addItem() {
    onChange({ ...config, items: [...config.items, { label: '' }] });
  }
  function removeItem(idx: number) {
    if (config.items.length <= 2) return;
    onChange({ ...config, items: config.items.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <div>
        <Label>Cartes ({config.items.length})</Label>
        <div className="space-y-3">
          {config.items.map((item, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <TextInput value={item.label} onChange={(v) => updateItem(idx, 'label', v)} placeholder={`Carte ${idx + 1}`} />
                {config.items.length > 2 && (
                  <button onClick={() => removeItem(idx)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <ImageUpload
                sessionId={sessionId}
                imageUrl={item.imageUrl ?? ''}
                onUploaded={(url) => updateItem(idx, 'imageUrl', url)}
                label="Image (optionnelle)"
              />
            </div>
          ))}
        </div>
        <button onClick={addItem} className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Ajouter une carte
        </button>
      </div>
    </div>
  );
}

function MatrixForm({ config, onChange }: { config: MatrixConfig; onChange: (c: MatrixConfig) => void }) {
  function updateRow(idx: number, v: string) {
    const rows = [...config.rows];
    rows[idx] = v;
    onChange({ ...config, rows });
  }
  function updateCol(idx: number, v: string) {
    const columns = [...config.columns];
    columns[idx] = v;
    onChange({ ...config, columns });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <TextInput value={config.question} onChange={(v) => onChange({ ...config, question: v })} placeholder="Entrez votre question…" multiline />
      </div>
      <div>
        <Label>Lignes ({config.rows.length})</Label>
        <div className="space-y-1.5">
          {config.rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextInput value={row} onChange={(v) => updateRow(idx, v)} placeholder={`Ligne ${idx + 1}`} />
              {config.rows.length > 1 && (
                <button onClick={() => onChange({ ...config, rows: config.rows.filter((_, i) => i !== idx) })} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => onChange({ ...config, rows: [...config.rows, ''] })} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Ajouter une ligne
        </button>
      </div>
      <div>
        <Label>Colonnes ({config.columns.length})</Label>
        <div className="space-y-1.5">
          {config.columns.map((col, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <TextInput value={col} onChange={(v) => updateCol(idx, v)} placeholder={`Colonne ${idx + 1}`} />
              {config.columns.length > 1 && (
                <button onClick={() => onChange({ ...config, columns: config.columns.filter((_, i) => i !== idx) })} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => onChange({ ...config, columns: [...config.columns, ''] })} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3 w-3" /> Ajouter une colonne
        </button>
      </div>
    </div>
  );
}

function PrototypeTaskForm({ config, onChange }: { config: PrototypeTaskConfig; onChange: (c: PrototypeTaskConfig) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>URL du prototype</Label>
        <TextInput
          value={config.url}
          onChange={(v) => onChange({ ...config, url: v })}
          placeholder="https://www.figma.com/proto/… ou URL live"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Figma Prototype, Marvel, InVision, ou n'importe quelle URL accessible publiquement.
        </p>
      </div>
      <div>
        <Label>Instructions pour le participant</Label>
        <TextInput
          value={config.instructions}
          onChange={(v) => onChange({ ...config, instructions: v })}
          placeholder="Ex: Essayez de trouver la page de paiement…"
          multiline
        />
      </div>
    </div>
  );
}

function FirstImpressionForm({ config, onChange, sessionId }: { config: FirstImpressionConfig; onChange: (c: FirstImpressionConfig) => void; sessionId: number }) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Instructions pour le participant</Label>
        <TextInput
          value={config.instructions}
          onChange={(v) => onChange({ ...config, instructions: v })}
          placeholder="Ex: Regardez attentivement ce qui va apparaître…"
          multiline
        />
      </div>
      <ImageUpload
        sessionId={sessionId}
        imageUrl={config.imageUrl}
        onUploaded={(url) => onChange({ ...config, imageUrl: url })}
        label="Image à afficher"
      />
      <RadioGroup
        label="Durée d'affichage"
        options={[
          { value: 3, label: '3 s' },
          { value: 5, label: '5 s' },
          { value: 10, label: '10 s' },
        ]}
        value={config.duration}
        onChange={(v) => onChange({ ...config, duration: v as 3 | 5 | 10 })}
      />
    </div>
  );
}

// ─── Condition editor ─────────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  answered: 'a été répondu',
  not_answered: "n'a pas été répondu",
  eq: 'est égal à',
  neq: 'est différent de',
};

function ConditionEditor({
  rule,
  precedingBlocks,
  onChange,
}: {
  rule: BlockVisibilityRule;
  precedingBlocks: SessionBlock[];
  onChange: (rule: BlockVisibilityRule) => void;
}) {
  const conditions = rule?.conditions ?? [];

  function addCondition() {
    const firstBlock = precedingBlocks[0];
    if (!firstBlock) return;
    const newCondition: BlockCondition = {
      sourceBlockId: firstBlock.id,
      operator: 'answered',
    };
    onChange({
      match: rule?.match ?? 'all',
      conditions: [...conditions, newCondition],
    });
  }

  function removeCondition(idx: number) {
    const next = conditions.filter((_, i) => i !== idx);
    onChange(next.length === 0 ? null : { match: rule?.match ?? 'all', conditions: next });
  }

  function updateCondition(idx: number, patch: Partial<BlockCondition>) {
    const next = conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ match: rule?.match ?? 'all', conditions: next });
  }

  function getBlockLabel(blockId: number) {
    const b = precedingBlocks.find((b) => b.id === blockId);
    if (!b) return `Bloc #${blockId}`;
    const config = b.config as Record<string, unknown>;
    const q = typeof config.question === 'string' ? config.question : '';
    const label = BLOCK_LABELS[b.blockType as BlockType] ?? b.blockType;
    return q.trim() ? `${label} — ${q.slice(0, 30)}${q.length > 30 ? '…' : ''}` : label;
  }

  const needsValue = (op: ConditionOperator) => op === 'eq' || op === 'neq';

  return (
    <div className="space-y-2">
      {conditions.length > 1 && (
        <div className="flex gap-1">
          {(['all', 'any'] as const).map((m) => (
            <button
              key={m}
              onClick={() => onChange({ match: m, conditions })}
              className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                rule?.match === m
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {m === 'all' ? 'ET (toutes)' : 'OU (une)'}
            </button>
          ))}
        </div>
      )}

      {conditions.map((cond, idx) => (
        <div key={idx} className="border border-border rounded-lg p-2.5 space-y-1.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              Condition {conditions.length > 1 ? idx + 1 : ''}
            </span>
            <button
              onClick={() => removeCondition(idx)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Source block */}
          <select
            value={cond.sourceBlockId}
            onChange={(e) => updateCondition(idx, { sourceBlockId: Number(e.target.value) })}
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
          >
            {precedingBlocks.map((b) => (
              <option key={b.id} value={b.id}>{getBlockLabel(b.id)}</option>
            ))}
          </select>

          {/* Operator */}
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(idx, { operator: e.target.value as ConditionOperator, value: undefined })}
            className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
          >
            {(Object.keys(OPERATOR_LABELS) as ConditionOperator[]).map((op) => (
              <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
            ))}
          </select>

          {/* Value (only for eq/neq) */}
          {needsValue(cond.operator) && (
            <input
              type="text"
              value={cond.value ?? ''}
              onChange={(e) => updateCondition(idx, { value: e.target.value })}
              placeholder="Valeur à comparer…"
              className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          )}
        </div>
      ))}

      {precedingBlocks.length > 0 && (
        <button
          onClick={addCondition}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Ajouter une condition
        </button>
      )}

      {precedingBlocks.length === 0 && conditions.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Aucun bloc précédent — ajoutez d'abord des blocs sur une page antérieure.
        </p>
      )}
    </div>
  );
}

// ─── Block type icon map ──────────────────────────────────────────────────────

const BLOCK_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  content: Type,
  short_text: AlignLeft,
  long_text: AlignJustify,
  mcq: CheckSquare,
  likert: BarChart2,
  rating: Star,
  nps: Gauge,
  card_sort: LayoutGrid,
  matrix: Table2,
  first_impression: Eye,
  prototype_task: Play,
};

// ─── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  return (
    <span className={`flex items-center gap-1 text-xs ${
      status === 'error' ? 'text-destructive' : 'text-muted-foreground'
    }`}>
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'saved' && <Check className="h-3 w-3 text-success" />}
      {status === 'error' && <AlertCircle className="h-3 w-3" />}
      {status === 'saving' ? 'Sauvegarde…' : status === 'saved' ? 'Sauvegardé' : 'Erreur'}
    </span>
  );
}

// ─── Block config form (auto-save) ────────────────────────────────────────────

interface BlockConfigFormProps {
  block: SessionBlock;
  sessionId: number;
  precedingBlocks: SessionBlock[];
  onBlockDeleted: (blockId: number) => void;
  onBlockUpdated: (blockId: number, updates: { config?: Record<string, unknown>; required?: boolean; conditions?: BlockVisibilityRule }) => void;
}

function BlockConfigForm({ block, sessionId, precedingBlocks, onBlockDeleted, onBlockUpdated }: BlockConfigFormProps) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    block.config as Record<string, unknown>
  );
  const [required, setRequired] = useState(block.required);
  const [conditions, setConditions] = useState<BlockVisibilityRule>(
    (block.conditions as BlockVisibilityRule) ?? null
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset local state when block changes
  useEffect(() => {
    setConfig(block.config as Record<string, unknown>);
    setRequired(block.required);
    setConditions((block.conditions as BlockVisibilityRule) ?? null);
    setSaveStatus('idle');
  }, [block.id]);

  const save = useCallback(
    async (newConfig: Record<string, unknown>, newRequired: boolean, newConditions: BlockVisibilityRule) => {
      setSaveStatus('saving');
      const result = await updateBlockAction(sessionId, block.id, {
        config: newConfig,
        required: newRequired,
        conditions: newConditions,
      });
      setSaveStatus(result.success ? 'saved' : 'error');
      if (result.success) {
        onBlockUpdated(block.id, { config: newConfig, required: newRequired, conditions: newConditions });
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    },
    [sessionId, block.id, onBlockUpdated]
  );

  function handleConfigChange(newConfig: Record<string, unknown>) {
    setConfig(newConfig);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(newConfig, required, conditions), 1000);
  }

  function handleRequiredChange(newRequired: boolean) {
    setRequired(newRequired);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(config, newRequired, conditions), 1000);
  }

  function handleConditionsChange(newConditions: BlockVisibilityRule) {
    setConditions(newConditions);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(config, required, newConditions), 1000);
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce bloc ?')) return;
    const result = await deleteBlockAction(sessionId, block.id);
    if (result.success) onBlockDeleted(block.id);
  }

  const blockType = block.blockType as BlockType;
  const Icon = BLOCK_ICONS[blockType] ?? AlignLeft;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground truncate">
            {BLOCK_LABELS[blockType] ?? blockType}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SaveIndicator status={saveStatus} />
          <button
            onClick={handleDelete}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Supprimer le bloc"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Required toggle — hidden for content blocks (no answer expected) */}
        {blockType !== 'content' && (
          <div className="pb-3 border-b border-border">
            <Toggle
              label="Réponse obligatoire"
              checked={required}
              onChange={handleRequiredChange}
            />
          </div>
        )}

        {/* Conditions — hidden for content blocks */}
        {blockType !== 'content' && (
          <div className="pb-3 border-b border-border space-y-2">
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Logique d'affichage</span>
              {conditions && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                  {conditions.conditions.length} condition{conditions.conditions.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {!conditions && (
              <p className="text-xs text-muted-foreground">Toujours affiché</p>
            )}
            <ConditionEditor
              rule={conditions}
              precedingBlocks={precedingBlocks}
              onChange={handleConditionsChange}
            />
          </div>
        )}

        {/* Type-specific fields */}
        {blockType === 'content' && (
          <ContentForm
            config={config as ContentConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'short_text' && (
          <ShortTextForm
            config={config as ShortTextConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'long_text' && (
          <LongTextForm
            config={config as LongTextConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'mcq' && (
          <McqForm
            config={config as McqConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'likert' && (
          <LikertForm
            config={config as LikertConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'rating' && (
          <RatingForm
            config={config as RatingConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'nps' && (
          <NpsForm
            config={config as NpsConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'card_sort' && (
          <CardSortForm
            config={config as CardSortConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
            sessionId={sessionId}
          />
        )}
        {blockType === 'matrix' && (
          <MatrixForm
            config={config as MatrixConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
        {blockType === 'first_impression' && (
          <FirstImpressionForm
            config={config as FirstImpressionConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
            sessionId={sessionId}
          />
        )}
        {blockType === 'prototype_task' && (
          <PrototypeTaskForm
            config={config as PrototypeTaskConfig}
            onChange={(c) => handleConfigChange(c as Record<string, unknown>)}
          />
        )}
      </div>
    </div>
  );
}

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  page: SessionPageWithBlocks | null;
  selectedBlockId: number | null;
  sessionId: number;
  precedingBlocks: SessionBlock[];
  onBlockDeleted: (blockId: number) => void;
  onBlockUpdated: (blockId: number, updates: { config?: Record<string, unknown>; required?: boolean; conditions?: BlockVisibilityRule }) => void;
}

export function ConfigPanel({
  page,
  selectedBlockId,
  sessionId,
  precedingBlocks,
  onBlockDeleted,
  onBlockUpdated,
}: ConfigPanelProps) {
  const selectedBlock =
    selectedBlockId != null
      ? page?.blocks.find((b) => b.id === selectedBlockId) ?? null
      : null;

  return (
    <aside
      className="border-l border-border bg-background flex flex-col overflow-hidden shrink-0"
      style={{ width: 320 }}
      aria-label="Panneau de configuration"
    >
      {!selectedBlock ? (
        <>
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Configuration
            </p>
          </div>
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center flex-1">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un bloc dans le canvas pour le configurer.
            </p>
          </div>
        </>
      ) : (
        <BlockConfigForm
          key={selectedBlock.id}
          block={selectedBlock}
          sessionId={sessionId}
          precedingBlocks={precedingBlocks}
          onBlockDeleted={onBlockDeleted}
          onBlockUpdated={onBlockUpdated}
        />
      )}
    </aside>
  );
}
