// Shared between the data pipeline (scripts/) and the static site (src/).

// ===== Edition configuration (config/editions/*.json) =====

export interface TopicConfig {
  name: string;
  weight: number;
  /**
   * Domain topic. When any topic in an edition is a gate, a paper must score at
   * least `minGateScore` on gate topics to be eligible — so method words
   * ("multimodal", "calibration") can't qualify an off-domain paper on their own.
   */
  gate?: boolean;
  /** Case-insensitive. Plain entries match whole words/phrases; a trailing `*` matches as a prefix. */
  keywords: string[];
}

export interface EditionConfig {
  slug: string;
  name: string;
  order: number;
  tagline: string;
  accent: { light: string; dark: string };
  /** Env var names checked in order for this edition's Discord webhook. */
  discordWebhookEnv: string[];
  /** Plain-language description of the reader, handed to the LLM editor. */
  readerProfile: string;
  arxivCategories: string[];
  /** When true a paper must hit at least one topic keyword to be considered. */
  requireTopicMatch: boolean;
  minHeuristicScore: number;
  /** Minimum score on gate topics (see TopicConfig.gate). Default 1. */
  minGateScore?: number;
  /**
   * Phrases searched in arXiv titles/abstracts over the last few days, across ALL
   * categories — catches papers outside `arxivCategories` (e.g. physics.ed-ph).
   */
  arxivQueries?: string[];
  /** Extra style instruction for this edition's editor's note. */
  editorVoice?: string;
  topics: TopicConfig[];
  exclude: string[];
  huggingface: { enabled: boolean; weight: number };
  selection: {
    candidates: number;
    minLlmScore: number;
    readFirst: number;
    lead: number;
    notable: number;
    radar: number;
  };
  dispatches: { enabled: boolean; max: number };
}

export interface FeedConfig {
  name: string;
  kind: 'lab' | 'newsletter';
  url: string;
  editions: string[];
  windowDays: number;
  includeCategories?: string[];
}

export interface Settings {
  publicationName: string;
  openRouterModels: string[];
  openRouterMaxTokens: number;
  huggingfaceDaysBack: number;
  /** How many days back the editions' arXiv keyword searches look. */
  searchWindowDays?: number;
  seenRetentionDays: number;
  dashboardUrl: string;
}

// ===== Raw candidates (pipeline-internal) =====

export interface CandidatePaper {
  /** arXiv id without version, e.g. "2611.03650". */
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  announceType?: 'new' | 'cross';
  publishedAt: string;
  /** 'search' = found by the edition's arxivQueries (category filter is skipped). */
  sources: Array<'arxiv' | 'huggingface' | 'search'>;
  hf?: HfSignal;
}

export interface HfSignal {
  upvotes: number;
  comments: number;
  organization?: string;
  githubRepo?: string;
}

// ===== Published issue (data/editions/<slug>/issues/<date>.json) =====

export type Tier = 'lead' | 'notable' | 'radar';

export interface IssuePaper extends CandidatePaper {
  url: string;
  pdfUrl: string;
  topics: string[];
  /** 0–100, the final ranking score. */
  score: number;
  heuristicScore: number;
  /** 0–10 from the LLM triage pass, when it ran. */
  llmScore?: number;
  /** One line on why this paper made the cut. */
  why?: string;
  tier: Tier;
}

export interface ReadFirstPick {
  id: string;
  why: string;
  takeaway?: string;
}

export interface Lede {
  headline: string;
  dek: string;
  /** Paragraphs. May reference papers inline as [arXiv-id]. */
  body: string[];
}

export interface Dispatch {
  id: string;
  title: string;
  url: string;
  source: string;
  kind: 'lab' | 'newsletter';
  date: string;
  summary: string;
}

export interface Issue {
  edition: string;
  date: string;
  number: number;
  generatedAt: string;
  editor: { mode: 'llm' | 'heuristic'; model?: string; note?: string };
  lede: Lede | null;
  readFirst: ReadFirstPick[];
  papers: IssuePaper[];
  dispatches: Dispatch[];
  topics: Array<{ name: string; count: number }>;
  stats: {
    screened: number;
    matched: number;
    alreadyFeatured: number;
    published: number;
    announcedOn?: string;
  };
}

export interface IssueIndexEntry {
  date: string;
  number: number;
  headline: string;
  published: number;
}

/** data/editions.json — the manifest the site boots from. */
export interface EditionManifestEntry {
  slug: string;
  name: string;
  order: number;
  tagline: string;
  accent: { light: string; dark: string };
  latest: string | null;
  issues: number;
}

export interface Manifest {
  publicationName: string;
  updatedAt: string;
  editions: EditionManifestEntry[];
}
