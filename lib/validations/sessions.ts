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

export const AddPageSchema = z.object({
  sessionId: z.number().int().positive(),
  afterPageId: z.number().int().positive(),
});

export const ReorderPagesSchema = z.object({
  sessionId: z.number().int().positive(),
  orderedPageIds: z.array(z.number().int().positive()).min(1),
});

const BLOCK_TYPES = [
  'content', 'short_text', 'long_text', 'mcq', 'likert', 'rating',
  'nps', 'card_sort', 'matrix', 'first_impression', 'prototype_task',
] as const;

export const AddBlockSchema = z.object({
  sessionId: z.number().int().positive(),
  pageId: z.number().int().positive(),
  blockType: z.enum(BLOCK_TYPES),
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

export const DeletePageSchema = z.object({
  sessionId: z.number().int().positive(),
  pageId: z.number().int().positive(),
});

export const DeleteSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});
