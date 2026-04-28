import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { projects, type Project, type NewProject } from '@/lib/db/schema';

/**
 * Récupère tous les projets d'un workspace (teamId).
 * Toujours filtré par teamId — AC6 : pas d'accès cross-workspace.
 */
export async function getProjectsByTeam(teamId: number): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.teamId, teamId))
    .orderBy(desc(projects.createdAt));
}

/**
 * Crée un nouveau projet dans le workspace.
 */
export async function createProject(
  data: Pick<NewProject, 'teamId' | 'name'>
): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({
      teamId: data.teamId,
      name: data.name,
    })
    .returning();

  if (!project) {
    throw new Error('Échec de la création du projet');
  }

  return project;
}

/**
 * Récupère un projet par son ID, en vérifiant le teamId (workspace isolation).
 * Retourne null si le projet n'appartient pas au workspace.
 */
export async function getProjectById(
  projectId: number,
  teamId: number
): Promise<Project | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
    .limit(1);

  return project ?? null;
}

/**
 * Supprime un projet, en vérifiant le teamId pour la sécurité.
 * Retourne true si le projet a été supprimé, false s'il n'existait pas.
 */
export async function deleteProject(
  projectId: number,
  teamId: number
): Promise<boolean> {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
    .returning({ id: projects.id });

  return deleted.length > 0;
}
