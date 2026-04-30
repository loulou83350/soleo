import { Sparkles, X } from 'lucide-react';
import type { TagSource } from '@/lib/db/schema';

// Maps `color` token from the DB to Tailwind classes. We use solid Tailwind
// scales here (not semantic CSS vars) because semantic tokens for non-status
// colors aren't all wired through @theme — and the chip palette is fixed.
const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-700' },
  red:    { bg: 'bg-red-100',    text: 'text-red-700' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-700' },
};

interface TagChipProps {
  label: string;
  color: string;
  source?: TagSource;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  pending?: boolean;
}

export function TagChip({
  label,
  color,
  source,
  onRemove,
  size = 'sm',
  pending = false,
}: TagChipProps) {
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.gray;
  const isAi = source === 'ai_auto' || source === 'ai_suggested';
  const sizing = size === 'md' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${cls.bg} ${cls.text} ${sizing} ${pending ? 'opacity-60' : ''}`}
    >
      {isAi && <Sparkles className="h-3 w-3 shrink-0" aria-label="Suggéré par IA" />}
      <span className="truncate max-w-[180px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer le tag ${label}`}
          className="shrink-0 hover:opacity-70 transition-opacity -mr-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/** Exported color list for color pickers. Keep in sync with COLOR_CLASSES keys. */
export const TAG_PALETTE = Object.keys(COLOR_CLASSES);

/** Returns the bg+text class string for a color token, useful for swatches. */
export function getTagColorClasses(color: string): string {
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.gray;
  return `${cls.bg} ${cls.text}`;
}
