// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Track keys we set so we can clean them up after each test
const originalEnv = { ...process.env };

afterEach(() => {
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
  // Clear module cache so flags.ts re-reads env on next import
  vi.resetModules();
});

beforeEach(() => {
  // Default: clear AI-related env vars to a known state
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.NEXT_PUBLIC_AI_TAG_SUGGEST;
  delete process.env.NEXT_PUBLIC_AI_FINDINGS;
  delete process.env.NEXT_PUBLIC_AI_FOLLOWUP;
  delete process.env.AI_AUTO_TAG;
});

async function loadFlags() {
  // Re-import after env mutations
  return import('./flags');
}

describe('hasAnyProvider', () => {
  it('returns false when no provider key is set', async () => {
    const flags = await loadFlags();
    expect(flags.hasAnyProvider()).toBe(false);
  });

  it.each(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'])(
    'returns true when %s is set',
    async (key) => {
      process.env[key] = 'sk-test';
      const flags = await loadFlags();
      expect(flags.hasAnyProvider()).toBe(true);
    }
  );
});

describe('isAITagSuggestEnabled', () => {
  it('is false when no provider key', async () => {
    process.env.NEXT_PUBLIC_AI_TAG_SUGGEST = 'true';
    const flags = await loadFlags();
    expect(flags.isAITagSuggestEnabled()).toBe(false);
  });

  it('defaults to true when key present and flag unset', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const flags = await loadFlags();
    expect(flags.isAITagSuggestEnabled()).toBe(true);
  });

  it('respects explicit "false"', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.NEXT_PUBLIC_AI_TAG_SUGGEST = 'false';
    const flags = await loadFlags();
    expect(flags.isAITagSuggestEnabled()).toBe(false);
  });

  it('respects "0" as false', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.NEXT_PUBLIC_AI_TAG_SUGGEST = '0';
    const flags = await loadFlags();
    expect(flags.isAITagSuggestEnabled()).toBe(false);
  });

  it('treats empty string as default (true)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.NEXT_PUBLIC_AI_TAG_SUGGEST = '';
    const flags = await loadFlags();
    expect(flags.isAITagSuggestEnabled()).toBe(true);
  });
});

describe('isAIAutoTagEnabled', () => {
  it('defaults to false even when provider is configured', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const flags = await loadFlags();
    expect(flags.isAIAutoTagEnabled()).toBe(false);
  });

  it('is true when explicitly enabled and provider present', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.AI_AUTO_TAG = 'true';
    const flags = await loadFlags();
    expect(flags.isAIAutoTagEnabled()).toBe(true);
  });

  it('stays false when set to true but no provider key', async () => {
    process.env.AI_AUTO_TAG = 'true';
    const flags = await loadFlags();
    expect(flags.isAIAutoTagEnabled()).toBe(false);
  });
});

describe('isAIFindingsEnabled / isAIFollowupEnabled', () => {
  it('both default to true when provider is configured', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const flags = await loadFlags();
    expect(flags.isAIFindingsEnabled()).toBe(true);
    expect(flags.isAIFollowupEnabled()).toBe(true);
  });

  it('toggle independently', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.NEXT_PUBLIC_AI_FINDINGS = 'false';
    const flags = await loadFlags();
    expect(flags.isAIFindingsEnabled()).toBe(false);
    expect(flags.isAIFollowupEnabled()).toBe(true);
  });
});
