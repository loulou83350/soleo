// AI feature flags — server side.
//
// Each AI feature can be turned on/off independently via env vars in .env.local
// (or Vercel project env vars). Defaults: ON when at least one provider key is
// configured, except `AI_AUTO_TAG` which is OFF by default (opt-in to avoid
// surprise costs).
//
// Client components should use `lib/ai/flags-client.ts` instead — it cannot
// check provider keys (server-only) but reads the same NEXT_PUBLIC_* values.

import 'server-only';

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false' && value !== '0';
}

/** True if at least one AI provider key is configured. */
export function hasAnyProvider(): boolean {
  return !!(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY
  );
}

/** Manual "Suggest tags" button on each response (Story 5.3, manual). */
export function isAITagSuggestEnabled(): boolean {
  return (
    hasAnyProvider() &&
    readBool(process.env.NEXT_PUBLIC_AI_TAG_SUGGEST, true)
  );
}

/** "Suggest AI draft" button on the findings editor (Story 6.1). */
export function isAIFindingsEnabled(): boolean {
  return (
    hasAnyProvider() &&
    readBool(process.env.NEXT_PUBLIC_AI_FINDINGS, true)
  );
}

/** AI follow-up generation during participant session (Epic 7). */
export function isAIFollowupEnabled(): boolean {
  return (
    hasAnyProvider() &&
    readBool(process.env.NEXT_PUBLIC_AI_FOLLOWUP, true)
  );
}

/** Background auto-tag on every saved response (Story 5.3, automatic). */
export function isAIAutoTagEnabled(): boolean {
  return hasAnyProvider() && readBool(process.env.AI_AUTO_TAG, false);
}
