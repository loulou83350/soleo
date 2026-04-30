import { z } from 'zod';

export const CreateSessionSchema = z.object({
  projectId: z.number().int().positive(),
});

export const UpdateSessionTitleSchema = z.object({
  sessionId: z.number().int().positive(),
  title: z
    .string()
    .min(1, 'Le titre est requis')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères')
    .trim(),
});

// Block types that can be added via the palette (excludes anchor types)
const PALETTE_BLOCK_TYPES = [
  'content', 'short_text', 'long_text', 'mcq', 'likert', 'rating',
  'nps', 'card_sort', 'matrix', 'first_impression', 'prototype_task',
] as const;

// All block types (for update/delete operations)
const ALL_BLOCK_TYPES = [
  'welcome', 'thank_you',
  'content', 'short_text', 'long_text', 'mcq', 'likert', 'rating',
  'nps', 'card_sort', 'matrix', 'first_impression', 'prototype_task',
] as const;

export const AddBlockSchema = z.object({
  sessionId: z.number().int().positive(),
  afterBlockId: z.number().int().positive(),
  blockType: z.enum(PALETTE_BLOCK_TYPES),
});

export const ReorderBlocksSchema = z.object({
  sessionId: z.number().int().positive(),
  orderedBlockIds: z.array(z.number().int().positive()).min(1),
});

export const UpdateBlockSchema = z.object({
  blockId: z.number().int().positive(),
  config: z.record(z.unknown()),
  required: z.boolean(),
});

export const DeleteBlockSchema = z.object({
  blockId: z.number().int().positive(),
});

export const UploadBlockImageSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const PublishSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

export const DeleteSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

// Re-export for any consumers that reference block type arrays
export { PALETTE_BLOCK_TYPES, ALL_BLOCK_TYPES };
