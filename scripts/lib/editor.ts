import type { EditionConfig, IssuePaper, Lede, ReadFirstPick } from '../../src/types/index.js';
import { extractJson, type LlmClient } from './llm.js';
import { firstSentences, truncate } from './text.js';

export interface Scored<T> {
  paper: T;
  heuristic: number;
  topics: string[];
  llmScore?: number;
  why?: string;
}

interface TriageRow {
  id: string;
  score: number;
  why?: string;
}

// 20 papers per call: larger batches ran out of output budget (reasoning tokens count against it).
const TRIAGE_BATCH = 20;

export function triagePrompt(
  edition: Pick<EditionConfig, 'readerProfile'>,
  papers: Array<{ id: string; title: string; abstract: string; topics: string[]; upvotes?: number }>,
): string {
  const list = papers
    .map(
      (p) =>
        `[${p.id}] ${p.title}\nTopics: ${p.topics.join(', ') || '—'}${p.upvotes !== undefined ? ` | Hugging Face upvotes: ${p.upvotes}` : ''}\nAbstract: ${truncate(p.abstract, 700)}`,
    )
    .join('\n\n');

  return `You are triaging today's new research preprints for one specific reader.

READER: ${edition.readerProfile}

Rate each paper 0–10 for how worthwhile it is for THIS reader to read today:
 9–10  likely to matter to the field, squarely on the reader's interests, substantive contribution
 7–8   solid and relevant — worth reading
 4–6   relevant but incremental — skim at most
 0–3   off-topic, thin, or only mentions the reader's area in passing
Be strict: most papers should score below 6. Judge only from the title and abstract; never invent details.
Write each "why" about the paper itself — never mention "the reader" or "this reader".

Return ONLY a JSON array with one object per paper:
[{"id": "<id exactly as given>", "score": <integer 0-10>, "why": "<max 18 words: the concrete contribution and why it matters to this reader>"}]

PAPERS:
${list}`;
}

/** LLM triage in batches. Failed batches simply keep their heuristic rank. */
export async function triage<T extends { id: string; title: string; abstract: string; hf?: { upvotes: number } }>(
  llm: LlmClient,
  edition: EditionConfig,
  items: Array<Scored<T>>,
): Promise<{ scoredBatches: number; failedBatches: number }> {
  let scoredBatches = 0;
  let failedBatches = 0;
  for (let i = 0; i < items.length; i += TRIAGE_BATCH) {
    const batch = items.slice(i, i + TRIAGE_BATCH);
    const prompt = triagePrompt(
      edition,
      batch.map((s) => ({
        id: s.paper.id,
        title: s.paper.title,
        abstract: s.paper.abstract,
        topics: s.topics,
        upvotes: s.paper.hf?.upvotes,
      })),
    );
    try {
      const rows = extractJson<TriageRow[]>(await llm.complete(prompt, { maxTokens: 8192, temperature: 0.1, reasoning: 'off' }));
      const byId = new Map(batch.map((s) => [s.paper.id, s]));
      let hits = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        const target = byId.get(String(row.id).replace(/^\[|\]$/g, '').trim());
        const score = Number(row.score);
        if (!target || !Number.isFinite(score)) continue;
        target.llmScore = Math.max(0, Math.min(10, Math.round(score)));
        if (row.why) target.why = truncate(String(row.why).trim(), 200);
        hits++;
      }
      if (hits === 0) throw new Error('no usable rows');
      scoredBatches++;
      console.log(`    ✓ triage batch ${i / TRIAGE_BATCH + 1}: scored ${hits}/${batch.length}`);
    } catch (error) {
      failedBatches++;
      console.warn(`    ⚠ triage batch ${i / TRIAGE_BATCH + 1} failed: ${(error as Error).message}`);
    }
  }
  return { scoredBatches, failedBatches };
}

interface EditorResponse {
  headline?: string;
  dek?: string;
  body?: string[] | string;
  readFirst?: Array<{ id: string; why?: string; takeaway?: string }>;
}

export function editorPrompt(
  publication: string,
  edition: Pick<EditionConfig, 'name' | 'readerProfile' | 'editorVoice'>,
  papers: IssuePaper[],
  readFirstCount: number,
): string {
  const list = papers
    .map(
      (p, i) =>
        `${i + 1}. [${p.id}] ${p.title}\n   Authors: ${p.authors.slice(0, 4).join(', ')}${p.authors.length > 4 ? ' et al.' : ''}${p.hf?.organization ? ` (${p.hf.organization})` : ''}\n   Topics: ${p.topics.join(', ') || '—'}\n   Triage note: ${p.why ?? '—'}\n   Abstract: ${truncate(p.abstract, 900)}`,
    )
    .join('\n\n');

  return `You are the editor of "${publication} — ${edition.name}", a short daily research briefing read over morning coffee by:
${edition.readerProfile}

Below are today's highest-ranked new papers, already selected. Write the front page.

Rules:
- Ground every claim in the abstracts below. No hype, no invented numbers, no speculation presented as fact.
- Cite papers inline by id in square brackets, e.g. [${papers[0]?.id ?? '2611.00001'}]. Every paper you mention must be cited this way.
- Find the genuine through-line if there is one; if today's papers are unrelated, say so plainly and highlight the strongest two or three.
- Plain, precise prose in the voice of a good science-section editor. No bullet points, no headings, no exclamation marks.
- The headline must be concrete: name the actual idea or finding (e.g. "Saliency maps fail the external-validation test"), never a generic summary like "Today's papers focus on X, Y and Z". Do not start the headline or the body with "Today".
- Put each paragraph in its own array element.${edition.editorVoice ? `\n- Voice for this edition: ${edition.editorVoice}` : ''}

Return ONLY JSON:
{
  "headline": "max 12 words — a concrete, specific claim; not a paper title, not a list of topics",
  "dek": "one sentence, max 30 words, expanding the headline",
  "body": ["paragraph", "paragraph", "optional third paragraph"],
  "readFirst": [{"id": "<id>", "why": "one sentence: why it is worth reading first (don't say 'the reader')", "takeaway": "one sentence: the key result or idea"}]
}
"body" should total 140–240 words. "readFirst" must contain exactly ${readFirstCount} different ids from the list.

TODAY'S PAPERS:
${list}`;
}

export async function writeFrontPage(
  llm: LlmClient,
  publication: string,
  edition: EditionConfig,
  papers: IssuePaper[],
): Promise<{ lede: Lede; readFirst: ReadFirstPick[] }> {
  const top = papers.slice(0, Math.max(edition.selection.lead, edition.selection.readFirst) + 2);
  const prompt = editorPrompt(publication, edition, top, edition.selection.readFirst);
  let res: EditorResponse;
  try {
    res = extractJson<EditorResponse>(await llm.complete(prompt, { temperature: 0.4, maxTokens: 12_000, reasoning: 'low' }));
  } catch (error) {
    // One retry without reasoning: the usual failure is a budget-exhausted or truncated reply.
    console.warn(`    ⚠ editor attempt 1 failed (${(error as Error).message}); retrying without reasoning`);
    res = extractJson<EditorResponse>(await llm.complete(prompt, { temperature: 0.4, maxTokens: 6000, reasoning: 'off' }));
  }
  const ids = new Set(papers.map((p) => p.id));

  const body = (Array.isArray(res.body) ? res.body : [String(res.body ?? '')])
    .flatMap((p) => String(p).split(/\n\s*\n/))
    .map((p) => p.trim())
    .filter(Boolean);
  if (!res.headline || body.length === 0) throw new Error('Editor response missing headline/body');

  const picks: ReadFirstPick[] = [];
  for (const r of res.readFirst ?? []) {
    const id = String(r.id).replace(/^\[|\]$/g, '').trim();
    if (ids.has(id) && !picks.some((p) => p.id === id) && r.why) {
      picks.push({ id, why: String(r.why).trim(), takeaway: r.takeaway ? String(r.takeaway).trim() : undefined });
    }
  }
  return {
    lede: { headline: String(res.headline).trim(), dek: String(res.dek ?? '').trim(), body },
    readFirst: fillReadFirst(picks, papers, edition.selection.readFirst),
  };
}

/** Top up (or build) read-first picks from the ranking, using only real data. */
export function fillReadFirst(picks: ReadFirstPick[], papers: IssuePaper[], n: number): ReadFirstPick[] {
  const out = [...picks];
  for (const p of papers) {
    if (out.length >= n) break;
    if (out.some((x) => x.id === p.id)) continue;
    out.push({ id: p.id, why: p.why ?? describeMatch(p), takeaway: firstSentences(p.abstract, 1) });
  }
  return out.slice(0, n);
}

export function describeMatch(p: Pick<IssuePaper, 'topics' | 'hf'>): string {
  const parts: string[] = [];
  if (p.topics.length) parts.push(`Matches ${p.topics.slice(0, 2).join(' and ')}`);
  if (p.hf) parts.push(`${p.hf.upvotes} upvotes on Hugging Face`);
  return parts.length ? `${parts.join(' · ')}.` : 'Top of today’s ranking.';
}
