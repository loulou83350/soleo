'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/db/queries';
import { getUserWithTeam } from '@/lib/db/queries';
import {
  getProjectsByTeam,
  createProject as createProjectRepo,
  deleteProject as deleteProjectRepo,
  getProjectById,
  type ProjectWithSessionCount,
} from '@/lib/repositories/projects';
import {
  CreateProjectSchema,
  DeleteProjectSchema,
} from '@/lib/validations/projects';
import type { ActionResult } from '@/lib/domain/types';
import type { Project } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

/**
 * Récupère tous les projets du workspace de l'utilisateur connecté.
 */
export async function listProjectsAction(): Promise<
  ActionResult<ProjectWithSessionCount[]>
> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { success: false, error: 'Aucun workspace trouvé' };
    }

    const data = await getProjectsByTeam(userWithTeam.teamId);
    return { success: true, data };
  } catch (err) {
    logger.error('listProjectsAction failed', { error: String(err) });
    return { success: false, error: 'Impossible de charger les projets' };
  }
}

/**
 * Crée un nouveau projet dans le workspace de l'utilisateur connecté.
 */
export async function createProjectAction(
  formData: FormData
): Promise<ActionResult<Project>> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { success: false, error: 'Aucun workspace trouvé' };
    }

    const raw = { name: formData.get('name') as string };
    const parsed = CreateProjectSchema.safeParse(raw);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? 'Données invalides';
      return { success: false, error: firstError };
    }

    const project = await createProjectRepo({
      teamId: userWithTeam.teamId,
      name: parsed.data.name,
    });

    revalidatePath('/dashboard');
    return { success: true, data: project };
  } catch (err) {
    logger.error('createProjectAction failed', { error: String(err) });
    return { success: false, error: 'Impossible de créer le projet' };
  }
}

/**
 * Supprime un projet du workspace de l'utilisateur connecté.
 * Vérifie que le projet appartient bien au workspace (teamId).
 */
export async function deleteProjectAction(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  try {
    const user = await getUser();
    if (!user) {
      return { success: false, error: 'Non authentifié' };
    }

    const userWithTeam = await getUserWithTeam(user.id);
    if (!userWithTeam?.teamId) {
      return { success: false, error: 'Aucun workspace trouvé' };
    }

    const rawId = formData.get('projectId');
    const parsed = DeleteProjectSchema.safeParse({
      projectId: Number(rawId),
    });

    if (!parsed.success) {
      return { success: false, error: 'ID de projet invalide' };
    }

    const { projectId } = parsed.data;

    // Vérifier que le projet appartient au workspace (sécurité)
    const existing = await getProjectById(projectId, userWithTeam.teamId);
    if (!existing) {
      return { success: false, error: 'Projet introuvable' };
    }

    await deleteProjectRepo(projectId, userWithTeam.teamId);

    revalidatePath('/dashboard');
    return { success: true, data: { id: projectId } };
  } catch (err) {
    logger.error('deleteProjectAction failed', { error: String(err) });
    return { success: false, error: 'Impossible de supprimer le projet' };
  }
}
