// Lightweight provider abstraction for tag suggestion. No SDK dependencies —
// direct fetch() to each vendor's REST API. Picks a provider based on:
//   1. Explicit `provider` argument from the caller
//   2. AI_PROVIDER env var (anthropic | gemini)
//   3. First key found among ANTHROPIC_API_KEY / GEMINI_API_KEY

export type AIProvider = 'anthropic' | 'gemini';

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
  return out;
}

export function getActiveProvider(): AIProvider | null {
  const env = process.env.AI_PROVIDER as AIProvider | undefined;
  if (env === 'anthropic' || env === 'gemini') {
    if (env === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (env === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
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
  const raw = provider === 'anthropic' ? await callAnthropic(prompt) : await callGemini(prompt);
  return parseTagsResponse(raw);
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === 'text')?.text ?? '';
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

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
