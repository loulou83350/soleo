import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { aiUsageLogs } from '@/lib/db/schema';

export interface UsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsdMicros: number;
  byFeature: Array<{
    feature: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsdMicros: number;
  }>;
}

/**
 * Aggregate AI usage for a team over a window starting at `since`.
 * Pass `since = startOfMonth()` for the "this month" view.
 */
export async function getUsageSummary(
  teamId: number,
  since: Date
): Promise<UsageSummary> {
  const rows = await db
    .select({
      feature: aiUsageLogs.feature,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
      costUsdMicros: sql<number>`coalesce(sum(${aiUsageLogs.costUsdMicros}), 0)::int`,
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.teamId, teamId),
        gte(aiUsageLogs.createdAt, since),
        eq(aiUsageLogs.status, 'ok')
      )
    )
    .groupBy(aiUsageLogs.feature);

  const summary: UsageSummary = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsdMicros: 0,
    byFeature: [],
  };

  for (const r of rows) {
    summary.totalCalls += r.calls;
    summary.totalInputTokens += r.inputTokens;
    summary.totalOutputTokens += r.outputTokens;
    summary.totalCostUsdMicros += r.costUsdMicros;
    summary.byFeature.push({
      feature: r.feature,
      calls: r.calls,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsdMicros: r.costUsdMicros,
    });
  }

  // Stable display order
  summary.byFeature.sort((a, b) => b.costUsdMicros - a.costUsdMicros);
  return summary;
}

export function startOfCurrentMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
