import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Formatters (FR locale) ──────────────────────────────────────────────────

/** "3m 12s" or "—" if null. Negative → 0. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** "78%" — input is a 0-1 ratio. */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${Math.round(ratio * 100)}%`;
}

/** "il y a 2 h", "il y a 3 j" — French relative time. */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const abs = Math.abs(diffSec);

  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
}

// ─── CSV helpers (Story 5.4) ─────────────────────────────────────────────────

/**
 * Quote and escape a single CSV field per RFC 4180:
 *  - Wrap in double quotes if it contains the separator, quote, CR or LF
 *  - Double-up internal quotes
 *  - null/undefined → empty string
 */
export function escapeCsvField(
  value: unknown,
  separator: string = ';'
): string {
  if (value == null) return '';
  let s = typeof value === 'string' ? value : String(value);
  // Normalize line breaks to \n inside CSV; some readers choke on \r\n
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (s.includes(separator) || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a CSV string from header + rows. Defaults to semicolon separator
 * (Excel-FR friendly) and prepends a UTF-8 BOM so accents render correctly
 * in Excel without manual import wizardry.
 */
export function buildCsv({
  header,
  rows,
  separator = ';',
  withBom = true,
}: {
  header: string[];
  rows: unknown[][];
  separator?: string;
  withBom?: boolean;
}): string {
  const lines: string[] = [];
  lines.push(header.map((h) => escapeCsvField(h, separator)).join(separator));
  for (const row of rows) {
    lines.push(row.map((c) => escapeCsvField(c, separator)).join(separator));
  }
  return (withBom ? '﻿' : '') + lines.join('\r\n');
}

/**
 * Slugify a label for safe use in CSV column names.
 *  - keep alphanumerics + underscore
 *  - collapse runs of non-alphanum to single underscore
 *  - lower-case
 *  - cap length
 */
export function slugifyForCsv(label: string, maxLen = 30): string {
  const slug = label
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen);
  return slug || 'sans_titre';
}
