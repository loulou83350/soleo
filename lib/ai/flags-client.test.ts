// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  vi.resetModules();
});

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_AI_TAG_SUGGEST;
  delete process.env.NEXT_PUBLIC_AI_FINDINGS;
  delete process.env.NEXT_PUBLIC_AI_FOLLOWUP;
});

async function loadFlags() {
  return import('./flags-client');
}

describe('client AI flags (no provider check, env-only)', () => {
  it('all default to true', async () => {
    const flags = await loadFlags();
    expect(flags.clientAITagSuggestEnabled()).toBe(true);
    expect(flags.clientAIFindingsEnabled()).toBe(true);
    expect(flags.clientAIFollowupEnabled()).toBe(true);
  });

  it('respect explicit false', async () => {
    process.env.NEXT_PUBLIC_AI_TAG_SUGGEST = 'false';
    process.env.NEXT_PUBLIC_AI_FINDINGS = 'false';
    process.env.NEXT_PUBLIC_AI_FOLLOWUP = 'false';
    const flags = await loadFlags();
    expect(flags.clientAITagSuggestEnabled()).toBe(false);
    expect(flags.clientAIFindingsEnabled()).toBe(false);
    expect(flags.clientAIFollowupEnabled()).toBe(false);
  });

  it('toggle independently', async () => {
    process.env.NEXT_PUBLIC_AI_FOLLOWUP = '0';
    const flags = await loadFlags();
    expect(flags.clientAITagSuggestEnabled()).toBe(true);
    expect(flags.clientAIFindingsEnabled()).toBe(true);
    expect(flags.clientAIFollowupEnabled()).toBe(false);
  });
});
