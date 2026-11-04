import Parser from 'rss-parser';
import type { CandidatePaper, Dispatch, FeedConfig } from '../../src/types/index.js';
import { fetchWithRetry, shortHash, USER_AGENT } from './io.js';
import { cleanArxivAbstract, collapseWhitespace, normalizeArxivId, toPlainText, truncate } from './text.js';

// ---------------------------------------------------------------- arXiv

const ARXIV_RSS = 'https://rss.arxiv.org/atom/';

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1].trim() : null;
}

export interface ArxivAnnouncement {
  papers: CandidatePaper[];
  /** Every entry in the feed, including revisions we drop. */
  totalEntries: number;
  replacementsDropped: number;
  announcedOn?: string;
}

/** Parse the arXiv Atom announcement feed. Exported for tests. */
export function parseArxivFeed(xml: string): ArxivAnnouncement {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const papers: CandidatePaper[] = [];
  let replacementsDropped = 0;
  let announcedOn: string | undefined;

  for (const entry of entries) {
    const announceType = (tag(entry, 'arxiv:announce_type') ?? 'new').toLowerCase();
    // "replace" / "replace-cross" are revisions of papers announced earlier — the
    // largest single source of noise in the old feed (~40% of entries).
    if (announceType.startsWith('replace')) {
      replacementsDropped++;
      continue;
    }
    const id = normalizeArxivId(tag(entry, 'id') ?? '');
    const title = toPlainText(tag(entry, 'title') ?? '');
    if (!id || !title) continue;

    const published = tag(entry, 'published') ?? '';
    if (!announcedOn && published) announcedOn = published.slice(0, 10);

    // Some submitters put affiliations in the author field: "A (Univ X, Dept Y), B".
    const creators = toPlainText(tag(entry, 'dc:creator') ?? '').replace(/\s*\([^()]*\)/g, '');
    papers.push({
      id,
      title,
      authors: creators ? creators.split(/,\s*(?:and\s+)?|\s+and\s+/).map((a) => a.trim()).filter(Boolean) : [],
      abstract: cleanArxivAbstract(tag(entry, 'summary') ?? ''),
      categories: [...entry.matchAll(/<category term="([^"]+)"/g)].map((m) => m[1]),
      announceType: announceType === 'cross' ? 'cross' : 'new',
      publishedAt: published,
      sources: ['arxiv'],
    });
  }
  return { papers, totalEntries: entries.length, replacementsDropped, announcedOn };
}

export async function fetchArxiv(categories: string[]): Promise<ArxivAnnouncement> {
  const url = `${ARXIV_RSS}${[...new Set(categories)].join('+')}`;
  const res = await fetchWithRetry(url, {}, { timeoutMs: 120_000 });
  return parseArxivFeed(await res.text());
}

// ---------------------------------------------------------------- arXiv keyword search

const ARXIV_API = 'https://export.arxiv.org/api/query';

/** Parse an arXiv API (search) Atom response. Exported for tests. */
export function parseArxivSearch(xml: string): CandidatePaper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const papers: CandidatePaper[] = [];
  for (const entry of entries) {
    const id = normalizeArxivId(tag(entry, 'id') ?? '');
    const title = toPlainText(tag(entry, 'title') ?? '');
    if (!id || !title || !/\d{4}\.\d{4,5}/.test(id)) continue;
    papers.push({
      id,
      title,
      authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => toPlainText(m[1])),
      abstract: toPlainText(tag(entry, 'summary') ?? ''),
      categories: [...entry.matchAll(/<category term="([^"]+)"/g)].map((m) => m[1]),
      publishedAt: tag(entry, 'published') ?? '',
      sources: ['search'],
    });
  }
  return papers;
}

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

/** Build the arXiv API query: any phrase in title or abstract, submitted in the window. */
export function buildSearchQuery(phrases: string[], days: number, now = new Date()): string {
  const terms = phrases.flatMap((p) => {
    const q = p.replace(/"/g, '').trim();
    return [`ti:"${q}"`, `abs:"${q}"`];
  });
  const from = new Date(now.getTime() - days * 86_400_000);
  return `(${terms.join(' OR ')}) AND submittedDate:[${yyyymmdd(from)}0000 TO ${yyyymmdd(now)}2359]`;
}

/**
 * Keyword search across all of arXiv for the last `days` days. Failures are
 * non-fatal: the edition simply falls back to its category feeds.
 */
export async function fetchArxivSearch(phrases: string[], days: number): Promise<CandidatePaper[]> {
  if (phrases.length === 0) return [];
  const params = new URLSearchParams({
    search_query: buildSearchQuery(phrases, days),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    max_results: '100',
  });
  const res = await fetchWithRetry(`${ARXIV_API}?${params}`, {}, { timeoutMs: 60_000 });
  return parseArxivSearch(await res.text());
}

// ---------------------------------------------------------------- Hugging Face

interface HfDailyPaper {
  paper?: {
    id: string;
    title?: string;
    summary?: string;
    authors?: Array<{ name: string }>;
    publishedAt?: string;
    upvotes?: number;
    githubRepo?: string;
    organization?: { fullname?: string; name?: string };
  };
  numComments?: number;
  organization?: { fullname?: string; name?: string };
}

export async function fetchHuggingFace(dates: string[]): Promise<CandidatePaper[]> {
  const byId = new Map<string, CandidatePaper>();
  for (const date of dates) {
    try {
      const res = await fetchWithRetry(`https://huggingface.co/api/daily_papers?date=${date}&limit=100`);
      const items = (await res.json()) as HfDailyPaper[];
      for (const item of items) {
        const p = item.paper;
        if (!p?.id) continue;
        const id = normalizeArxivId(p.id);
        const upvotes = p.upvotes ?? 0;
        const existing = byId.get(id);
        // Same paper listed on several days: keep the highest vote count.
        if (existing && (existing.hf?.upvotes ?? 0) >= upvotes) continue;
        const org = item.organization ?? p.organization;
        byId.set(id, {
          id,
          title: collapseWhitespace(p.title ?? ''),
          authors: (p.authors ?? []).map((a) => a.name),
          abstract: collapseWhitespace(p.summary ?? ''),
          categories: [],
          publishedAt: p.publishedAt ?? date,
          sources: ['huggingface'],
          hf: {
            upvotes,
            comments: item.numComments ?? 0,
            organization: org?.fullname || org?.name || undefined,
            githubRepo: p.githubRepo || undefined,
          },
        });
      }
    } catch (error) {
      console.warn(`  ⚠ Hugging Face ${date}: ${(error as Error).message}`);
    }
  }
  return [...byId.values()];
}

/** Merge HF signals into arXiv entries by id; HF-only papers are appended. */
export function mergeSources(arxiv: CandidatePaper[], hf: CandidatePaper[]): CandidatePaper[] {
  const byId = new Map(arxiv.map((p) => [p.id, { ...p }]));
  for (const h of hf) {
    const a = byId.get(h.id);
    if (a) {
      a.hf = h.hf;
      a.sources = [...new Set([...a.sources, 'huggingface' as const])];
    } else {
      byId.set(h.id, h);
    }
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------- RSS dispatches

type FeedItem = { 'content:encoded'?: string; categories?: string[] };
const rss: Parser<Record<string, never>, FeedItem> = new Parser({
  timeout: 20_000,
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  customFields: { item: ['content:encoded'] },
});

export interface FeedResult {
  feed: FeedConfig;
  items: Dispatch[];
  error?: string;
}

export async function fetchFeed(feed: FeedConfig, now = new Date()): Promise<FeedResult> {
  try {
    const parsed = await rss.parseURL(feed.url);
    const cutoff = now.getTime() - feed.windowDays * 86_400_000;
    const items: Dispatch[] = [];
    for (const entry of parsed.items ?? []) {
      const date = entry.isoDate || entry.pubDate || '';
      const t = Date.parse(date);
      if (!date || Number.isNaN(t) || t < cutoff || t > now.getTime() + 86_400_000) continue;
      if (feed.includeCategories?.length) {
        const cats = (entry.categories ?? []).map((c) => toPlainText(String(c)));
        if (!cats.some((c) => feed.includeCategories!.includes(c))) continue;
      }
      const title = toPlainText(entry.title ?? '');
      if (!title || !entry.link) continue;
      const body = toPlainText(entry.contentSnippet || entry['content:encoded'] || entry.content || '');
      items.push({
        id: shortHash(entry.link),
        title,
        url: entry.link,
        source: feed.name,
        kind: feed.kind,
        date: new Date(t).toISOString(),
        summary: truncate(body, 280),
      });
    }
    return { feed, items };
  } catch (error) {
    // A dead feed contributes nothing. Never invent placeholder content.
    return { feed, items: [], error: (error as Error).message };
  }
}
