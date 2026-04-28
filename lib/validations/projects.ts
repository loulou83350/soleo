import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom du projet est requis')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
});

export const DeleteProjectSchema = z.object({
  projectId: z.number().int().positive(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type DeleteProjectInput = z.infer<typeof DeleteProjectSchema>;
