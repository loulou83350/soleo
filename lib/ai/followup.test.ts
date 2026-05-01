// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The DB shouldn't be touched in these prompt tests
vi.mock('@/lib/db/drizzle', () => ({ db: {} }));
vi.mock('@/lib/db/schema', () => ({ aiUsageLogs: {} }));

import { buildUserPrompt, SYSTEM_PROMPT } from './followup';

describe('SYSTEM_PROMPT', () => {
  it('mentions the strict 25-word limit', () => {
    expect(SYSTEM_PROMPT).toContain('25 mots');
  });

  it('forbids preamble like "Merci pour…"', () => {
    expect(SYSTEM_PROMPT).toContain('préambule');
  });

  it('asks for output without quotes or markdown', () => {
    expect(SYSTEM_PROMPT).toMatch(/sans guillemets/);
    expect(SYSTEM_PROMPT).toMatch(/sans markdown/);
  });
});

describe('buildUserPrompt — turn 1 (no history)', () => {
  it('includes the original question and answer verbatim', () => {
    const prompt = buildUserPrompt({
      originalQuestion: "Que pensez-vous de l'app ?",
      originalAnswer: 'Pas claire au premier abord.',
      history: [],
      turnNumber: 1,
      maxTurns: 2,
    });

    expect(prompt).toContain("Que pensez-vous de l'app ?");
    expect(prompt).toContain('Pas claire au premier abord.');
    expect(prompt).toContain('relance numéro 1/2');
  });

  it('omits the "ÉCHANGES PRÉCÉDENTS" section when history is empty', () => {
    const prompt = buildUserPrompt({
      originalQuestion: 'Q',
      originalAnswer: 'A',
      history: [],
      turnNumber: 1,
      maxTurns: 1,
    });
    expect(prompt).not.toContain('ÉCHANGES PRÉCÉDENTS');
  });
});

describe('buildUserPrompt — turn 2 (one prior turn)', () => {
  it('includes the prior AI question + participant answer', () => {
    const prompt = buildUserPrompt({
      originalQuestion: 'Quel est votre process ?',
      originalAnswer: 'Je commence par la recherche utilisateur.',
      history: [
        {
          question: 'Quels outils utilisez-vous pour cette recherche ?',
          answer: 'Notion et Google Forms.',
        },
      ],
      turnNumber: 2,
      maxTurns: 3,
    });

    expect(prompt).toContain('ÉCHANGES PRÉCÉDENTS');
    expect(prompt).toContain('Quels outils utilisez-vous pour cette recherche ?');
    expect(prompt).toContain('Notion et Google Forms.');
    expect(prompt).toContain('relance numéro 2/3');
  });
});

describe('buildUserPrompt — turn 3 (two prior turns)', () => {
  it('includes both prior turns in chronological order', () => {
    const prompt = buildUserPrompt({
      originalQuestion: 'Q',
      originalAnswer: 'A',
      history: [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
      ],
      turnNumber: 3,
      maxTurns: 3,
    });

    const idxQ1 = prompt.indexOf('Q1');
    const idxQ2 = prompt.indexOf('Q2');
    expect(idxQ1).toBeGreaterThan(-1);
    expect(idxQ2).toBeGreaterThan(idxQ1);
    expect(prompt).toContain('A1');
    expect(prompt).toContain('A2');
    expect(prompt).toContain('relance numéro 3/3');
  });
});
