// Pure aggregation helpers — given a flat list of raw response values for a
// single block, return a typed summary used by the cross-participant view.
// All functions are total (no exceptions), tolerate malformed JSON, and never
// touch the DB.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextSummary {
  kind: 'text';
  count: number;
  samples: string[]; // non-empty trimmed answers, in order received
}

export interface McqSummary {
  kind: 'mcq';
  count: number;
  /** option label → number of participants who picked it */
  distribution: Record<string, number>;
  /** sorted desc by count for display */
  ranked: Array<{ option: string; count: number; ratio: number }>;
}

export interface ScaleSummary {
  kind: 'scale';
  count: number;
  /** scale value → count */
  distribution: Record<number, number>;
  min: number;
  max: number;
  average: number | null;
  median: number | null;
}

export interface NpsSummary {
  kind: 'nps';
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** -100 … +100, null if no responses */
  score: number | null;
  distribution: Record<number, number>; // 0..10
}

export interface CardSortSummary {
  kind: 'card_sort';
  count: number;
  /** label → average position (1-indexed). Lower = ranked higher. */
  averagePosition: Record<string, number>;
  ranked: Array<{ label: string; averagePosition: number }>;
}

export interface MatrixSummary {
  kind: 'matrix';
  count: number;
  /** rowLabel → colLabel → count */
  perRow: Record<string, Record<string, number>>;
}

export interface FirstImpressionSummary {
  kind: 'first_impression';
  count: number;
}

export interface PrototypeTaskSummary {
  kind: 'prototype_task';
  count: number;
  completed: number;
  goalReached: number;
  manualCompletion: number;
  skipped: number;
  /** seconds, computed only over completed (incl. manual) */
  avgDurationSec: number | null;
}

export type BlockSummary =
  | TextSummary
  | McqSummary
  | ScaleSummary
  | NpsSummary
  | CardSortSummary
  | MatrixSummary
  | FirstImpressionSummary
  | PrototypeTaskSummary;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function meanOf(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function medianOf(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── Per-type summarizers ────────────────────────────────────────────────────

export function summarizeText(values: unknown[]): TextSummary {
  const samples = values
    .filter((v): v is string => typeof v === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return { kind: 'text', count: samples.length, samples };
}

export function summarizeMcq(values: unknown[]): McqSummary {
  const distribution: Record<string, number> = {};
  let count = 0;
  for (const v of values) {
    const arr = Array.isArray(v) ? (v as unknown[]) : null;
    if (!arr || arr.length === 0) continue;
    count++;
    for (const opt of arr) {
      if (typeof opt === 'string' && opt.trim()) {
        distribution[opt] = (distribution[opt] ?? 0) + 1;
      }
    }
  }
  const ranked = Object.entries(distribution)
    .map(([option, c]) => ({ option, count: c, ratio: count === 0 ? 0 : c / count }))
    .sort((a, b) => b.count - a.count);
  return { kind: 'mcq', count, distribution, ranked };
}

export function summarizeScale(
  values: unknown[],
  expectedMin = 1,
  expectedMax = 5
): ScaleSummary {
  const nums = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
  const distribution: Record<number, number> = {};
  for (let i = expectedMin; i <= expectedMax; i++) distribution[i] = 0;
  for (const n of nums) {
    const k = Math.round(n);
    distribution[k] = (distribution[k] ?? 0) + 1;
  }
  return {
    kind: 'scale',
    count: nums.length,
    distribution,
    min: expectedMin,
    max: expectedMax,
    average: meanOf(nums),
    median: medianOf(nums),
  };
}

export function summarizeNps(values: unknown[]): NpsSummary {
  const nums = values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 10);

  const distribution: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) distribution[i] = 0;
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const n of nums) {
    const k = Math.round(n);
    distribution[k]++;
    if (k <= 6) detractors++;
    else if (k <= 8) passives++;
    else promoters++;
  }
  const total = nums.length;
  const score = total === 0 ? null : Math.round(((promoters - detractors) / total) * 100);
  return {
    kind: 'nps',
    count: total,
    promoters,
    passives,
    detractors,
    score,
    distribution,
  };
}

export function summarizeCardSort(values: unknown[]): CardSortSummary {
  const positionsByLabel: Record<string, number[]> = {};
  let count = 0;
  for (const v of values) {
    if (!Array.isArray(v)) continue;
    count++;
    v.forEach((item, idx) => {
      const label =
        item && typeof item === 'object' && 'label' in item && typeof (item as { label: unknown }).label === 'string'
          ? ((item as { label: string }).label).trim()
          : null;
      if (!label) return;
      (positionsByLabel[label] = positionsByLabel[label] ?? []).push(idx + 1);
    });
  }
  const averagePosition: Record<string, number> = {};
  for (const [label, positions] of Object.entries(positionsByLabel)) {
    averagePosition[label] = meanOf(positions) ?? 0;
  }
  const ranked = Object.entries(averagePosition)
    .map(([label, p]) => ({ label, averagePosition: p }))
    .sort((a, b) => a.averagePosition - b.averagePosition);
  return { kind: 'card_sort', count, averagePosition, ranked };
}

export function summarizeMatrix(values: unknown[]): MatrixSummary {
  const perRow: Record<string, Record<string, number>> = {};
  let count = 0;
  for (const v of values) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const map = v as Record<string, unknown>;
    let answered = false;
    for (const [row, col] of Object.entries(map)) {
      if (typeof col !== 'string' || !col.trim()) continue;
      answered = true;
      const r = (perRow[row] = perRow[row] ?? {});
      r[col] = (r[col] ?? 0) + 1;
    }
    if (answered) count++;
  }
  return { kind: 'matrix', count, perRow };
}

export function summarizeFirstImpression(values: unknown[]): FirstImpressionSummary {
  const count = values.filter((v) => v === 'seen' || (v != null && v !== '')).length;
  return { kind: 'first_impression', count };
}

interface PrototypeRaw {
  completed?: boolean;
  skipped?: boolean;
  manualCompletion?: boolean;
  goalReached?: boolean;
  /** stored in MILLISECONDS by ParticipantBlock */
  timeOnTask?: number | null;
}

export function summarizePrototypeTask(values: unknown[]): PrototypeTaskSummary {
  let count = 0;
  let completed = 0;
  let goalReached = 0;
  let manualCompletion = 0;
  let skipped = 0;
  const durationsSec: number[] = [];

  for (const v of values) {
    if (!v || typeof v !== 'object') continue;
    count++;
    const r = v as PrototypeRaw;
    if (r.skipped) {
      skipped++;
    } else if (r.completed) {
      completed++;
      if (r.goalReached) goalReached++;
      if (r.manualCompletion) manualCompletion++;
      if (typeof r.timeOnTask === 'number' && r.timeOnTask > 0) {
        durationsSec.push(r.timeOnTask / 1000);
      }
    }
  }

  return {
    kind: 'prototype_task',
    count,
    completed,
    goalReached,
    manualCompletion,
    skipped,
    avgDurationSec: meanOf(durationsSec),
  };
}

// ─── Dispatch by block type ──────────────────────────────────────────────────

export function summarizeForBlock(
  blockType: string,
  config: Record<string, unknown>,
  values: unknown[]
): BlockSummary | null {
  switch (blockType) {
    case 'short_text':
    case 'long_text':
      return summarizeText(values);
    case 'mcq':
      return summarizeMcq(values);
    case 'likert': {
      const scale = Number(config.scale ?? 5);
      return summarizeScale(values, 1, scale);
    }
    case 'rating': {
      const max = Number(config.max ?? 5);
      return summarizeScale(values, 1, max);
    }
    case 'nps':
      return summarizeNps(values);
    case 'card_sort':
      return summarizeCardSort(values);
    case 'matrix':
      return summarizeMatrix(values);
    case 'first_impression':
      return summarizeFirstImpression(values);
    case 'prototype_task':
      return summarizePrototypeTask(values);
    default:
      return null;
  }
}
