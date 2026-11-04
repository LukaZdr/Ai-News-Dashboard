import type { CandidatePaper, EditionConfig, TopicConfig } from '../../src/types/index.js';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a keyword into a case-insensitive regex.
 *  - "mri"        → whole word: matches "MRI" but not "MRIs"... use "mri*" for that
 *  - "radiolog*"  → prefix: radiology, radiologist, radiological
 *  - "chain of thought" → whole phrase, flexible whitespace/hyphen between words
 * Word boundaries stop the substring false-positives of the old tagger
 * ("rl" in "world", "oss" in "loss", "rag" in "average").
 */
export function compileKeyword(keyword: string): RegExp {
  const prefix = keyword.endsWith('*');
  const core = prefix ? keyword.slice(0, -1) : keyword;
  const body = core
    .trim()
    .split(/[\s-]+/)
    .map(escapeRegex)
    .join('[\\s-]+');
  return new RegExp(`(?<![\\w])${body}${prefix ? '' : '(?![\\w])'}`, 'i');
}

export interface CompiledTopic {
  name: string;
  weight: number;
  gate: boolean;
  patterns: RegExp[];
}

export interface CompiledProfile {
  topics: CompiledTopic[];
  exclude: RegExp[];
  /** True when the edition marks some topics as gates. */
  hasGates: boolean;
}

export function compileProfile(edition: Pick<EditionConfig, 'topics' | 'exclude'>): CompiledProfile {
  return {
    topics: edition.topics.map((t: TopicConfig) => ({
      name: t.name,
      weight: t.weight,
      gate: Boolean(t.gate),
      patterns: t.keywords.map(compileKeyword),
    })),
    exclude: edition.exclude.map(compileKeyword),
    hasGates: edition.topics.some((t) => t.gate),
  };
}

/** Penalty per matched exclude phrase. */
export const EXCLUDE_PENALTY = 6;

export interface HeuristicResult {
  score: number;
  topicScore: number;
  /** Score on gate topics only; equals topicScore when the edition has no gates. */
  gateScore: number;
  topics: string[];
  excluded: number;
}

/**
 * Transparent, deterministic relevance score.
 *  - topic hit in the title: 3 × weight
 *  - topic hits in the abstract: 1 × weight per distinct keyword, capped at 2
 *  - each exclude phrase: −EXCLUDE_PENALTY
 *  - Hugging Face Daily Papers: 3 + 3·log2(1 + upvotes), scaled by the edition's HF weight
 */
export function heuristicScore(
  paper: Pick<CandidatePaper, 'title' | 'abstract' | 'hf'>,
  profile: CompiledProfile,
  hfWeight = 1,
): HeuristicResult {
  let topicScore = 0;
  let gateScore = 0;
  const topics: Array<{ name: string; s: number }> = [];

  for (const topic of profile.topics) {
    const inTitle = topic.patterns.some((p) => p.test(paper.title));
    const abstractHits = topic.patterns.filter((p) => p.test(paper.abstract)).length;
    const s = topic.weight * ((inTitle ? 3 : 0) + Math.min(2, abstractHits));
    if (s > 0) {
      topicScore += s;
      if (topic.gate || !profile.hasGates) gateScore += s;
      topics.push({ name: topic.name, s });
    }
  }

  const text = `${paper.title} ${paper.abstract}`;
  const excluded = profile.exclude.filter((p) => p.test(text)).length;

  const hfBoost = paper.hf ? hfWeight * (3 + 3 * Math.log2(1 + paper.hf.upvotes)) : 0;

  return {
    score: Math.round((topicScore - EXCLUDE_PENALTY * excluded + hfBoost) * 10) / 10,
    topicScore,
    gateScore,
    topics: topics.sort((a, b) => b.s - a.s).map((t) => t.name),
    excluded,
  };
}

/** Whether a paper is eligible for an edition before ranking. */
export function isEligible(
  paper: Pick<CandidatePaper, 'categories' | 'sources'>,
  edition: Pick<EditionConfig, 'arxivCategories' | 'requireTopicMatch' | 'minHeuristicScore' | 'minGateScore'>,
  result: HeuristicResult,
): boolean {
  // HF-only papers come without categories, and keyword-search hits are wanted
  // precisely because they may sit outside the edition's categories: for both,
  // the topic match decides.
  const inCategory =
    paper.categories.length === 0 ||
    paper.sources.includes('search') ||
    paper.categories.some((c) => edition.arxivCategories.includes(c));
  if (!inCategory) return false;
  if (!edition.requireTopicMatch) return result.score >= edition.minHeuristicScore;
  // Focused editions: eligibility is about topical relevance alone. Community
  // upvotes only re-rank papers that already qualify on topic.
  if (result.gateScore <= 0 || result.gateScore < (edition.minGateScore ?? 1)) return false;
  const topical = result.topicScore - EXCLUDE_PENALTY * result.excluded;
  return topical >= edition.minHeuristicScore;
}

/** Blend LLM judgement (0–10) with the heuristic into a 0–100 score. */
export function blendScore(heuristic: number, maxHeuristic: number, llm?: number): number {
  const h = maxHeuristic > 0 ? Math.max(0, heuristic) / maxHeuristic : 0;
  if (llm === undefined) return Math.round(h * 100);
  return Math.round((0.75 * (llm / 10) + 0.25 * h) * 100);
}
