'use server';

import { getUser } from '@/lib/db/queries';
import { getUserWithTeam } from '@/lib/db/queries';
import {
  getUsageSummary,
  startOfCurrentMonth,
  type UsageSummary,
} from '@/lib/repositories/ai-usage';

export async function getCurrentMonthUsageAction(): Promise<{
  ok: true;
  summary: UsageSummary;
} | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Non authentifié' };
  const userWithTeam = await getUserWithTeam(user.id);
  if (!userWithTeam?.teamId) return { ok: false, error: 'Aucune équipe' };

  const summary = await getUsageSummary(userWithTeam.teamId, startOfCurrentMonth());
  return { ok: true, summary };
}
