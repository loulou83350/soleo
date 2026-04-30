// Lightweight provider abstraction for tag suggestion. No SDK dependencies —
// direct fetch() to each vendor's REST API. Picks a provider based on:
//   1. Explicit `provider` argument from the caller
//   2. AI_PROVIDER env var (anthropic | gemini)
//   3. First key found among ANTHROPIC_API_KEY / GEMINI_API_KEY

import { logAIUsage, type AIFeature } from './usage';

export type AIProvider = 'anthropic' | 'gemini' | 'openai';

/** Context for per-call usage logging. Passed by callers (server actions). */
export interface AIUsageContext {
  teamId: number | null;
  userId: number | null;
  feature: AIFeature;
  sessionId?: number | null;
}

/** Internal: every low-level call function returns tokens + model. */
interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface TagSuggestion {
  label: string;
  /** True if the model proposed creating a new tag, false if reusing an existing one */
  isNew: boolean;
}

interface SuggestParams {
  responseText: string;
  blockType: string;
  /** The question / prompt that the participant was answering */
  question?: string;
  existingTags: string[];
  provider?: AIProvider;
  /** Optional usage logging context (skipped if absent) */
  usage?: AIUsageContext;
}

const PROMPT_TEMPLATE = (p: SuggestParams) => {
  const existingList = p.existingTags.length > 0 ? p.existingTags.join(', ') : '(none yet)';
  return `You are a UX research analyst. Given a participant's response, suggest 1 to 3 short tag labels (1–3 words each, in French) that capture the dominant themes.

CONSTRAINTS
- Reuse an existing tag whenever it fits — do NOT invent a synonym.
- Only invent a new label when none of the existing tags applies.
- Tag labels must be specific and reusable across studies (e.g. "Confusion navigation", "Demande pricing", "Manque de feedback") — NOT verbatim quotes.
- Skip empty / non-substantive answers — return an empty array if there's nothing worth tagging.

EXISTING TAGS: ${existingList}

QUESTION (block type ${p.blockType}): ${p.question ?? '(unknown)'}

PARTICIPANT'S RESPONSE: ${JSON.stringify(p.responseText).slice(0, 4000)}

Return STRICT JSON, no prose, no markdown:
{"tags": [{"label": "string", "isNew": boolean}]}`;
};

// ─── Provider detection ──────────────────────────────────────────────────────

export function getAvailableProviders(): AIProvider[] {
  const out: AIProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) out.push('anthropic');
  if (process.env.GEMINI_API_KEY) out.push('gemini');
  if (process.env.OPENAI_API_KEY) out.push('openai');
  return out;
}

export function getActiveProvider(): AIProvider | null {
  const env = process.env.AI_PROVIDER as AIProvider | undefined;
  if (env === 'anthropic' || env === 'gemini' || env === 'openai') {
    if (env === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (env === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
    if (env === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
  }
  const available = getAvailableProviders();
  return available[0] ?? null;
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function suggestTagsForResponse(
  params: SuggestParams
): Promise<TagSuggestion[]> {
  const provider = params.provider ?? getActiveProvider();
  if (!provider) {
    throw new Error('No AI provider configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)');
  }
  const prompt = PROMPT_TEMPLATE(params);
  const started = Date.now();
  let result: ProviderResult;
  try {
    switch (provider) {
      case 'anthropic':
        result = await callAnthropic(prompt, 400, 0.2);
        break;
      case 'gemini':
        result = await callGemini(prompt, 400, 0.2, true);
        break;
      case 'openai':
        result = await callOpenAI(prompt, 400, 0.2, true);
        break;
    }
  } catch (e) {
    if (params.usage) {
      await logAIUsage({
        teamId: params.usage.teamId,
        userId: params.usage.userId,
        feature: params.usage.feature,
        provider,
        model: '',
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorMessage: (e as Error).message?.slice(0, 500) ?? 'unknown',
        sessionId: params.usage.sessionId ?? null,
        durationMs: Date.now() - started,
      });
    }
    throw e;
  }
  if (params.usage) {
    await logAIUsage({
      teamId: params.usage.teamId,
      userId: params.usage.userId,
      feature: params.usage.feature,
      provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'ok',
      sessionId: params.usage.sessionId ?? null,
      durationMs: Date.now() - started,
    });
  }
  return parseTagsResponse(result.text);
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(
  prompt: string,
  maxTokens: number,
  temperature: number
): Promise<ProviderResult> {
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
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
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
  return {
    text: data.content?.find((c) => c.type === 'text')?.text ?? '',
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    model,
  };
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function callGemini(
  prompt: string,
  maxOutputTokens: number,
  temperature: number,
  jsonMode: boolean
): Promise<ProviderResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const model = 'gemini-2.0-flash';
  const generationConfig: Record<string, unknown> = {
    temperature,
    maxOutputTokens,
  };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    model,
  };
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(
  prompt: string,
  maxTokens: number,
  temperature: number,
  jsonMode: boolean
): Promise<ProviderResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI API ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    model,
  };
}

// ─── Findings report generation (Story 6.1) ─────────────────────────────────

export interface FindingsResponseInput {
  /** block_responses.id — the AI MUST cite this id when referencing this answer */
  id: number;
  blockId: number;
  text: string;
}

export interface FindingsBlockInput {
  id: number;
  blockType: string;
  question: string;
  responses: FindingsResponseInput[];
  /** Optional aggregate hint: "Avg 4.2/5", "Top option: X (12 votes)", "NPS +12" */
  aggregateHint?: string;
}

export interface GenerateFindingsParams {
  sessionTitle: string;
  participantCount: number;
  blocks: FindingsBlockInput[];
  /** Tag distribution per block: blockId → "tag (count), tag (count)" */
  tagsByBlock?: Record<number, string>;
  provider?: AIProvider;
  /** Cap responses per block to this many (cost control). Default 80. */
  maxResponsesPerBlock?: number;
  /** Optional usage logging context (skipped if absent) */
  usage?: AIUsageContext;
}

/**
 * Builds a prompt that instructs the model to produce structured markdown
 * with `{r:ID}` citation tokens after every claim/quote, and never to
 * fabricate IDs.
 */
function buildFindingsPrompt(p: GenerateFindingsParams): string {
  const cap = p.maxResponsesPerBlock ?? 80;
  const blocksJson = p.blocks
    .map((b) => {
      // Truncate long lists; sample the longest answers (most informative)
      const sorted = [...b.responses].sort(
        (a, b2) => b2.text.length - a.text.length
      );
      const sample = sorted.slice(0, cap);
      const responsesText = sample
        .map(
          (r) =>
            `    - id=${r.id}: ${JSON.stringify(r.text).slice(0, 800)}`
        )
        .join('\n');
      const tagInfo = p.tagsByBlock?.[b.id]
        ? `\n  Tags: ${p.tagsByBlock[b.id]}`
        : '';
      const aggInfo = b.aggregateHint ? `\n  ${b.aggregateHint}` : '';
      return `Question (block_id=${b.id}, type=${b.blockType}): "${b.question}"${aggInfo}${tagInfo}\n  Réponses (${b.responses.length}, montrant ${sample.length}) :\n${responsesText}`;
    })
    .join('\n\n');

  return `Tu es analyste UX senior. Tu produis une synthèse écrite des résultats d'une étude utilisateur.

ÉTUDE
- Titre : "${p.sessionTitle}"
- ${p.participantCount} participants ont répondu

DONNÉES PAR QUESTION
${blocksJson}

RÈGLES STRICTES — À RESPECTER ABSOLUMENT
1. Tu écris en français.
2. À CHAQUE claim, statistique, ou citation, tu attaches la ou les sources au format \`{r:ID}\` immédiatement après la phrase. Plusieurs sources possibles, exemple : \`Plusieurs participants ont signalé une difficulté {r:42}{r:57}{r:89}.\`
3. N'utilise QUE les ids déjà listés dans DONNÉES. Tu n'inventes JAMAIS d'id.
4. Tu cites au moins 2-3 sources par paragraphe principal.
5. Tu produis du markdown avec exactement ces sections :
   # Synthèse
   (1 paragraphe d'intro avec les chiffres clés et 2-3 citations)

   ## Constats principaux
   (3 à 5 sous-sections \`### \` numérotées avec les patterns observés, citations à l'appui)

   ## Recommandations
   (liste à puces avec des actions concrètes, chacune ancrée à au moins 1 source)

6. Tu ne mets PAS de bloc de citations en bas. Les sources sont uniquement inline via {r:ID}.
7. Tu ne cites pas une réponse vide ou inexploitable.
8. Sortie : MARKDOWN UNIQUEMENT, pas d'explication, pas de préambule.`;
}

/**
 * Validate / sanitize the model's output:
 *  - Strip code fences if any
 *  - Remove {r:ID} tokens whose ID isn't in the allowed set (hallucination)
 */
export function validateFindingsMarkdown(
  markdown: string,
  validResponseIds: Set<number>
): string {
  let text = markdown.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:markdown|md)?\s*/, '').replace(/```\s*$/, '');
  }
  // Strip invalid tokens
  return text.replace(/\{r:(\d+)\}/g, (full, id) => {
    return validResponseIds.has(Number(id)) ? full : '';
  });
}

export async function generateFindingsReport(
  params: GenerateFindingsParams
): Promise<string> {
  const provider = params.provider ?? getActiveProvider();
  if (!provider) {
    throw new Error('No AI provider configured (ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY)');
  }
  const prompt = buildFindingsPrompt(params);
  const started = Date.now();

  let result: ProviderResult;
  try {
    switch (provider) {
      case 'anthropic':
        result = await callAnthropic(prompt, 3000, 0.4);
        break;
      case 'gemini':
        result = await callGemini(prompt, 3000, 0.4, false);
        break;
      case 'openai':
        result = await callOpenAI(prompt, 3000, 0.4, false);
        break;
    }
  } catch (e) {
    if (params.usage) {
      await logAIUsage({
        teamId: params.usage.teamId,
        userId: params.usage.userId,
        feature: params.usage.feature,
        provider,
        model: '',
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorMessage: (e as Error).message?.slice(0, 500) ?? 'unknown',
        sessionId: params.usage.sessionId ?? null,
        durationMs: Date.now() - started,
      });
    }
    throw e;
  }
  if (params.usage) {
    await logAIUsage({
      teamId: params.usage.teamId,
      userId: params.usage.userId,
      feature: params.usage.feature,
      provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'ok',
      sessionId: params.usage.sessionId ?? null,
      durationMs: Date.now() - started,
    });
  }
  return result.text;
}

// Long-output variants merged into the parametrized callers above —
// `generateFindingsReport` passes maxTokens=3000, temperature=0.4, jsonMode=false.

// ─── Response parsing (lenient) ──────────────────────────────────────────────

function parseTagsResponse(raw: string): TagSuggestion[] {
  if (!raw) return [];
  // Strip Markdown code fences if present
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
  }
  // Try to locate the outermost JSON object
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return [];
  text = text.slice(jsonStart, jsonEnd + 1);

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return []; }

  if (!parsed || typeof parsed !== 'object') return [];
  const tags = (parsed as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return [];

  return tags
    .map((t) => {
      if (!t || typeof t !== 'object') return null;
      const obj = t as { label?: unknown; isNew?: unknown };
      const label = typeof obj.label === 'string' ? obj.label.trim() : null;
      if (!label) return null;
      return { label, isNew: Boolean(obj.isNew) } satisfies TagSuggestion;
    })
    .filter((t): t is TagSuggestion => t !== null)
    .slice(0, 3); // hard cap
}
