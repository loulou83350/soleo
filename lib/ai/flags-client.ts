// AI feature flags — client side.
//
// Mirror of lib/ai/flags.ts but only reads NEXT_PUBLIC_* env vars (so it can
// run in the browser bundle). Cannot check provider keys (server-only) — the
// component is expected to also receive `availableProviders` from the server
// page as a secondary guard, and the server route/action will reject if the
// feature is gated.

function readBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false' && value !== '0';
}

export function clientAITagSuggestEnabled(): boolean {
  return readBool(process.env.NEXT_PUBLIC_AI_TAG_SUGGEST, true);
}

export function clientAIFindingsEnabled(): boolean {
  return readBool(process.env.NEXT_PUBLIC_AI_FINDINGS, true);
}

export function clientAIFollowupEnabled(): boolean {
  return readBool(process.env.NEXT_PUBLIC_AI_FOLLOWUP, true);
}
