import type { BlockType, BlockConfig } from '@/lib/db/schema';

// ─── Per-type config shapes ──────────────────────────────────────────────────

export type ContentConfig = {
  title: string;
  body: string;
};

export type ShortTextConfig = {
  question: string;
  placeholder: string;
};

export type LongTextConfig = {
  question: string;
  placeholder: string;
  aiFollowUp: boolean;
  maxTurns: 1 | 2 | 3;
};

export type McqConfig = {
  question: string;
  options: string[];
  allowMultiple: boolean;
  randomize: boolean;
  allowOther: boolean;
};

export type LikertConfig = {
  question: string;
  scale: 3 | 5 | 7;
  lowLabel: string;
  highLabel: string;
};

export type RatingConfig = {
  question: string;
  max: 5 | 10;
};

export type NpsConfig = {
  question: string;
  lowLabel: string;
  highLabel: string;
};

export type CardSortItem = {
  label: string;
  imageUrl?: string;
};

export type CardSortConfig = {
  question: string;
  items: CardSortItem[];
};

export type MatrixConfig = {
  question: string;
  rows: string[];
  columns: string[];
};

export type FirstImpressionConfig = {
  imageUrl: string;
  duration: 3 | 5 | 10;
  instructions: string;
};

export type PrototypeTaskConfig = {
  url: string;
  instructions: string;
};

// ─── Default configs ─────────────────────────────────────────────────────────

export const BLOCK_DEFAULTS: Record<BlockType, BlockConfig> = {
  content: {
    title: '',
    body: '',
  } satisfies ContentConfig,

  short_text: {
    question: '',
    placeholder: '',
  } satisfies ShortTextConfig,

  long_text: {
    question: '',
    placeholder: '',
    aiFollowUp: false,
    maxTurns: 1,
  } satisfies LongTextConfig,

  mcq: {
    question: '',
    options: ['', '', '', ''],
    allowMultiple: false,
    randomize: false,
    allowOther: false,
  } satisfies McqConfig,

  likert: {
    question: '',
    scale: 5,
    lowLabel: "Pas du tout d'accord",
    highLabel: "Tout à fait d'accord",
  } satisfies LikertConfig,

  rating: {
    question: '',
    max: 5,
  } satisfies RatingConfig,

  nps: {
    question: '',
    lowLabel: 'Pas du tout probable',
    highLabel: 'Très probable',
  } satisfies NpsConfig,

  card_sort: {
    question: '',
    items: [{ label: '' }, { label: '' }, { label: '' }],
  } satisfies CardSortConfig,

  matrix: {
    question: '',
    rows: ['', ''],
    columns: ['', '', ''],
  } satisfies MatrixConfig,

  first_impression: {
    imageUrl: '',
    duration: 5,
    instructions: '',
  } satisfies FirstImpressionConfig,

  prototype_task: {
    url: '',
    instructions: '',
  } satisfies PrototypeTaskConfig,
};

// ─── UI labels ───────────────────────────────────────────────────────────────

export const BLOCK_LABELS: Record<BlockType, string> = {
  content: 'Texte / Titre',
  short_text: 'Question courte',
  long_text: 'Question longue',
  mcq: 'Choix multiple',
  likert: 'Échelle de Likert',
  rating: 'Note',
  nps: 'NPS',
  card_sort: 'Tri de carte',
  matrix: 'Matrice',
  first_impression: 'Premier regard',
  prototype_task: 'Tâche prototype',
};

// Ordered for BlockPalette display (prototype_task last / disabled)
export const BLOCK_PALETTE_ORDER: BlockType[] = [
  'content',
  'short_text',
  'long_text',
  'mcq',
  'likert',
  'rating',
  'nps',
  'card_sort',
  'matrix',
  'first_impression',
  'prototype_task',
];
