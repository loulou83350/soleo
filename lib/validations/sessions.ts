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
