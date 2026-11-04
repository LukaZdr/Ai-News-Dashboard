import { fetchWithRetry } from './io.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** 'off' disables thinking entirely — no reasoning tokens, so no risk of an empty, budget-exhausted reply. */
export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high';

export interface LlmClient {
  model: string;
  complete(
    prompt: string,
    opts?: { maxTokens?: number; temperature?: number; reasoning?: ReasoningEffort },
  ): Promise<string>;
}

export function createLlm(apiKey: string | undefined, models: string[], defaultMaxTokens: number): LlmClient | null {
  if (!apiKey || models.length === 0) return null;
  return {
    model: models[0],
    async complete(prompt, { maxTokens = defaultMaxTokens, temperature = 0.2, reasoning = 'low' } = {}) {
      const res = await fetchWithRetry(
        OPENROUTER_URL,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/LukaZdr/Ai-News-Dashboard',
            'X-Title': 'The Preprint',
          },
          body: JSON.stringify({
            // OpenRouter falls through the list if the first model is unavailable.
            model: models[0],
            ...(models.length > 1 ? { models } : {}),
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature,
            // Reasoning models otherwise spend the whole budget thinking and return
            // empty content (finish_reason "length"). Triage needs little deliberation.
            reasoning: reasoning === 'off' ? { enabled: false } : { effort: reasoning, exclude: true },
          }),
        },
        { timeoutMs: 240_000, retries: 2 },
      );
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        error?: { message?: string };
      };
      if (json.error) throw new Error(json.error.message ?? 'OpenRouter error');
      const choice = json.choices?.[0];
      const content = choice?.message?.content ?? '';
      if (!content.trim()) throw new Error(`Empty LLM response (finish_reason: ${choice?.finish_reason ?? 'unknown'})`);
      return content;
    },
  };
}

/**
 * Pull the first JSON value out of a model response. Tolerates code fences,
 * <think> blocks and prose around the JSON.
 */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '');
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in LLM response');
  const open = cleaned[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) as T;
  }
  throw new Error('Unterminated JSON in LLM response');
}
