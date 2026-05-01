// AI follow-up question generator (Epic 7 — Story 7.2).
//
// Given the original question + the participant's answer (and any earlier
// turns), generate ONE relevant relance question that helps deepen the
// answer. Streams tokens back so the participant sees the question appear
// progressively.
//
// V1 implements streaming for OpenAI only (the user's current provider).
// For Anthropic / Gemini, we fall back to non-streaming via the abstraction
// in lib/ai/providers.ts and yield the full text at once.

import 'server-only';
import { getActiveProvider, type AIProvider } from './providers';
import { logAIUsage } from './usage';

export interface FollowupTurn {
  /** Question initiale (1) ou question de l'IA (>1) */
  question: string;
  /** Réponse du participant à cette question */
  answer: string;
}

export interface FollowupParams {
  originalQuestion: string;
  originalAnswer: string;
  /** Earlier turns (oldest first). Empty for the first follow-up. */
  history: FollowupTurn[];
  turnNumber: number; // 1-indexed
  maxTurns: number;
}

export interface UsageContext {
  teamId: number | null;
  sessionId: number | null;
}

interface StreamYield {
  /** Stream of question tokens (incremental chunks) */
  stream: AsyncIterable<string>;
  /** Resolves to the final question + provider/model + tokens once stream ends */
  finalize: () => Promise<{
    fullText: string;
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export const SYSTEM_PROMPT = `Tu es un chercheur UX expérimenté qui mène un entretien semi-directif. Tu viens de lire la réponse d'un participant à une question. Génère UNE question de relance pour creuser, dans la même langue que la réponse.

CONTRAINTES STRICTES :
- 1 seule question, courte (max 25 mots)
- Pas de préambule ("Merci pour…", "Intéressant…")
- Pas de jugement, pas d'opinion
- Ouverte (jamais oui/non)
- Cible le concret : "Pouvez-vous me donner un exemple de…", "Qu'est-ce qui vous a amené à…", "Quand cela s'est-il produit pour la dernière fois ?"
- Si la réponse est vague ou courte → demande un exemple ou une situation
- Si la réponse est riche → creuse un détail spécifique mentionné

Sortie : la question seule, sans guillemets, sans markdown, sans préfixe.`;

export function buildUserPrompt(params: FollowupParams): string {
  const history =
    params.history.length === 0
      ? ''
      : '\n\nÉCHANGES PRÉCÉDENTS :\n' +
        params.history
          .map(
            (t, i) =>
              `Q${i + 1} (IA): ${t.question}\nR${i + 1} (participant): ${t.answer}`
          )
          .join('\n');

  return `QUESTION ORIGINELLE : "${params.originalQuestion}"
RÉPONSE DU PARTICIPANT : "${params.originalAnswer}"${history}

C'est ton tour de relance numéro ${params.turnNumber}/${params.maxTurns}.`;
}

/**
 * Public entry point — chooses the active provider and returns a
 * stream + finalize handle. Caller is responsible for consuming the stream
 * and then calling finalize() to get usage data + log it.
 */
export async function streamFollowupQuestion(
  params: FollowupParams,
  ctx: UsageContext
): Promise<StreamYield> {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error('No AI provider configured');
  }

  const userPrompt = buildUserPrompt(params);
  const started = Date.now();

  if (provider === 'openai') {
    return streamOpenAI(SYSTEM_PROMPT, userPrompt, ctx, started);
  }

  // Fallback (no streaming): use the existing call helpers and yield once
  return fakeStreamFromNonStreaming(provider, SYSTEM_PROMPT, userPrompt, ctx, started);
}

// ─── OpenAI streaming ────────────────────────────────────────────────────────

async function streamOpenAI(
  systemPrompt: string,
  userPrompt: string,
  ctx: UsageContext,
  started: number
): Promise<StreamYield> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 80,
      temperature: 0.6,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  let fullText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  async function* tokens(): AsyncIterable<string> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by \n\n; each event has data: lines
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const evt of events) {
        const dataLine = evt
          .split('\n')
          .find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        const payload = dataLine.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          // Last frame contains usage when stream_options.include_usage=true
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? 0;
            outputTokens = parsed.usage.completion_tokens ?? 0;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            yield delta;
          }
        } catch {
          // Ignore parse errors on individual frames
        }
      }
    }
  }

  return {
    stream: tokens(),
    finalize: async () => {
      await logAIUsage({
        teamId: ctx.teamId,
        userId: null, // participant flow — no logged-in user
        feature: 'ai_followup',
        provider: 'openai',
        model,
        inputTokens,
        outputTokens,
        status: 'ok',
        sessionId: ctx.sessionId,
        durationMs: Date.now() - started,
      });
      return {
        fullText: fullText.trim(),
        provider: 'openai',
        model,
        inputTokens,
        outputTokens,
      };
    },
  };
}

// ─── Non-streaming fallback (Anthropic / Gemini) ─────────────────────────────

async function fakeStreamFromNonStreaming(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  ctx: UsageContext,
  started: number
): Promise<StreamYield> {
  // Combine system + user into one prompt — the existing callers don't
  // separate roles, and Gemini doesn't have a system role natively in our
  // current wiring. Keep it simple.
  const combined = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  // Lazy import to avoid pulling in providers logic when not needed
  const { suggestTagsForResponse: _unused } = await import('./providers');
  void _unused;

  // We can't reuse suggestTagsForResponse (different shape). For V1, just
  // call the provider directly via fetch like providers.ts does, but only
  // for Anthropic. Gemini is not implemented for follow-up streaming yet.
  //
  // To keep the codebase small, we re-use a minimal call here.
  if (provider !== 'anthropic') {
    throw new Error(
      `Follow-up streaming not implemented for provider "${provider}" yet`
    );
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  const model = 'claude-haiku-4-5';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 80,
      temperature: 0.6,
      messages: [{ role: 'user', content: combined }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const fullText = (
    data.content?.find((c) => c.type === 'text')?.text ?? ''
  ).trim();
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;

  // Yield the whole text in one chunk (no real streaming)
  async function* once(): AsyncIterable<string> {
    if (fullText) yield fullText;
  }

  return {
    stream: once(),
    finalize: async () => {
      await logAIUsage({
        teamId: ctx.teamId,
        userId: null,
        feature: 'ai_followup' as 'tag_suggest',
        provider: 'anthropic',
        model,
        inputTokens,
        outputTokens,
        status: 'ok',
        sessionId: ctx.sessionId,
        durationMs: Date.now() - started,
      });
      return { fullText, provider: 'anthropic', model, inputTokens, outputTokens };
    },
  };
}
