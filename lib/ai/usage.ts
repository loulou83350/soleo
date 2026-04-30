// AI usage logging + cost computation.
//
// Cost is stored as integer micro-USD (1_000_000 = 1 USD) in `ai_usage_logs`
// to avoid floating-point math. Pricing is hard-coded here — when a vendor
// updates prices, edit the table below and the next call gets the new rate.
//
// Public prices (USD per 1M tokens) as of 2025-04. Update when needed:
//   Anthropic: https://www.anthropic.com/pricing
//   Google:    https://ai.google.dev/pricing
//   OpenAI:    https://openai.com/api/pricing/

import { db } from '@/lib/db/drizzle';
import { aiUsageLogs } from '@/lib/db/schema';
import type { AIProvider } from './providers';

export type AIFeature = 'tag_suggest' | 'findings_generate' | 'auto_tag';

interface ModelPrice {
  /** USD per 1M input tokens */
  input: number;
  /** USD per 1M output tokens */
  output: number;
}

const PRICES: Record<string, ModelPrice> = {
  // Anthropic
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-latest': { input: 0.8, output: 4.0 },
  // Google
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  // OpenAI
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

/**
 * Cost in micro-USD given a model name + input/output tokens.
 * `tokens * pricePerMillion` already gives micros (since 1 USD = 1e6 micros
 * and pricePerMillion has units of USD per 1M tokens).
 */
export function computeCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return Math.round(inputTokens * p.input + outputTokens * p.output);
}

export function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

interface LogParams {
  teamId: number | null;
  userId: number | null;
  feature: AIFeature;
  provider: AIProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: 'ok' | 'error';
  errorMessage?: string | null;
  sessionId?: number | null;
  durationMs: number;
}

/**
 * Insert a usage log. Swallows all errors — never break a user flow because
 * the log table is unhappy.
 */
export async function logAIUsage(params: LogParams): Promise<void> {
  try {
    const costUsdMicros = computeCostMicros(
      params.model,
      params.inputTokens,
      params.outputTokens
    );
    await db.insert(aiUsageLogs).values({
      teamId: params.teamId,
      userId: params.userId,
      feature: params.feature,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsdMicros,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      sessionId: params.sessionId ?? null,
      durationMs: params.durationMs,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ai-usage] failed to log usage:', e);
  }
}
