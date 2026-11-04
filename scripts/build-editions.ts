/**
 * Daily pipeline: fetch once, then build one issue per edition.
 *
 *   npm run build:editions                       # all editions
 *   npm run build:editions -- --edition medical  # one edition
 *   npm run build:editions -- --no-llm           # heuristic ranking only
 *   npm run build:editions -- --dry-run          # print, write nothing
 *   npm run build:editions -- --skip-existing    # keep editions that already have today's issue
 *
 * Output (per edition):
 *   data/editions/<slug>/latest.json             today's issue
 *   data/editions/<slug>/issues/<date>.json      archive
 *   data/editions/<slug>/index.json              archive index (newest first)
 *   data/editions/<slug>/seen.json               ids already featured (no repeats)
 *   data/editions.json                           manifest the site boots from
 */
import 'dotenv/config';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  CandidatePaper,
  Dispatch,
  EditionConfig,
  EditionManifestEntry,
  FeedConfig,
  Issue,
  IssueIndexEntry,
  IssuePaper,
  Manifest,
  Settings,
  Tier,
} from '../src/types/index.js';
import { CONFIG_DIR, DATA_DIR, daysBetween, readJson, todayUtc, writeJson } from './lib/io.js';
import { createLlm, type LlmClient } from './lib/llm.js';
import { blendScore, compileProfile, heuristicScore, isEligible } from './lib/scoring.js';
import { fetchArxiv, fetchArxivSearch, fetchFeed, fetchHuggingFace, mergeSources, type FeedResult } from './lib/sources.js';
import { describeMatch, fillReadFirst, triage, writeFrontPage, type Scored } from './lib/editor.js';
import { loadEditions } from './lib/editions.js';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const editionDir = (slug: string) => join(DATA_DIR, 'editions', slug);

type Seen = Record<string, string>; // id → date first featured

function pruneSeen(seen: Seen, today: string, retentionDays: number): Seen {
  return Object.fromEntries(Object.entries(seen).filter(([, d]) => daysBetween(d, today) <= retentionDays));
}

function tierFor(rank: number, sel: EditionConfig['selection']): Tier | null {
  if (rank < sel.lead) return 'lead';
  if (rank < sel.lead + sel.notable) return 'notable';
  if (rank < sel.lead + sel.notable + sel.radar) return 'radar';
  return null;
}

async function buildEdition(
  edition: EditionConfig,
  sharedPool: CandidatePaper[],
  searchHits: CandidatePaper[],
  feeds: FeedResult[],
  ctx: { today: string; settings: Settings; llm: LlmClient | null; announcedOn?: string; dryRun: boolean },
): Promise<Issue | null> {
  const { today, settings, llm } = ctx;
  console.log(`\n━━ ${edition.name} ━━`);
  const dir = editionDir(edition.slug);
  const seen = pruneSeen(readJson<Seen>(join(dir, 'seen.json'), {}), today, settings.seenRetentionDays);
  // Papers featured earlier today stay eligible so a same-day re-run reproduces the issue.
  const featuredBefore = (id: string) => seen[id] !== undefined && seen[id] !== today;

  // The shared pool plus this edition's keyword-search hits that the feeds didn't already carry.
  const known = new Set(sharedPool.map((p) => p.id));
  const extra = searchHits.filter((p) => !known.has(p.id));
  const pool = [...sharedPool, ...extra];
  if (edition.arxivQueries?.length) console.log(`  🔎 keyword search added ${extra.length} papers beyond the feeds`);

  const profile = compileProfile(edition);
  let alreadyFeatured = 0;
  const eligible: Array<Scored<CandidatePaper>> = [];
  for (const paper of pool) {
    if (paper.sources.includes('huggingface') && !paper.sources.includes('arxiv') && !edition.huggingface.enabled) continue;
    const h = heuristicScore(paper, profile, edition.huggingface.enabled ? edition.huggingface.weight : 0);
    if (!isEligible(paper, edition, h)) continue;
    if (featuredBefore(paper.id)) {
      alreadyFeatured++;
      continue;
    }
    eligible.push({ paper, heuristic: h.score, topics: h.topics });
  }
  eligible.sort((a, b) => b.heuristic - a.heuristic);
  console.log(`  ${eligible.length} eligible of ${pool.length} screened (${alreadyFeatured} already featured)`);

  if (eligible.length === 0) {
    console.log('  → nothing new; no issue today.');
    return null;
  }

  const candidates = eligible.slice(0, edition.selection.candidates);
  let editorNote: string | undefined;
  let usedLlm = false;
  if (llm) {
    console.log(`  🤖 triaging ${candidates.length} candidates with ${llm.model}`);
    const { scoredBatches, failedBatches } = await triage(llm, edition, candidates);
    usedLlm = scoredBatches > 0;
    if (failedBatches) editorNote = `${failedBatches} triage batch(es) failed; those papers are ranked heuristically.`;
  }

  const maxH = Math.max(...candidates.map((c) => c.heuristic), 1);
  const kept = candidates.filter((c) => c.llmScore === undefined || c.llmScore >= edition.selection.minLlmScore);
  const ranked = kept
    .map((c) => ({ ...c, final: blendScore(c.heuristic, maxH, c.llmScore) }))
    .sort((a, b) => b.final - a.final || b.heuristic - a.heuristic);

  const papers: IssuePaper[] = [];
  ranked.forEach((c, rank) => {
    const tier = tierFor(rank, edition.selection);
    if (!tier) return;
    const p = c.paper;
    const issuePaper: IssuePaper = {
      ...p,
      url: `https://arxiv.org/abs/${p.id}`,
      pdfUrl: `https://arxiv.org/pdf/${p.id}`,
      topics: c.topics,
      score: c.final,
      heuristicScore: c.heuristic,
      ...(c.llmScore !== undefined ? { llmScore: c.llmScore } : {}),
      tier,
    };
    issuePaper.why = c.why ?? describeMatch(issuePaper);
    papers.push(issuePaper);
  });

  if (papers.length === 0) {
    console.log('  → triage rejected every candidate; no issue today.');
    return null;
  }

  // Front page
  let lede: Issue['lede'] = null;
  let readFirst = fillReadFirst([], papers, edition.selection.readFirst);
  if (llm) {
    try {
      console.log('  ✍️  writing the front page');
      ({ lede, readFirst } = await writeFrontPage(llm, settings.publicationName, edition, papers));
      usedLlm = true;
    } catch (error) {
      console.warn(`  ⚠ editor failed: ${(error as Error).message} — front page falls back to the top paper`);
      editorNote = [editorNote, 'Editor’s note unavailable today.'].filter(Boolean).join(' ');
    }
  }

  // Dispatches (RSS) — each item appears once.
  const dispatches: Dispatch[] = edition.dispatches.enabled
    ? feeds
        .filter((f) => f.feed.editions.includes(edition.slug))
        .flatMap((f) => f.items)
        .filter((d) => !featuredBefore(`d:${d.id}`))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, edition.dispatches.max)
    : [];

  const topicCounts = new Map<string, number>();
  for (const p of papers.filter((p) => p.tier !== 'radar')) {
    for (const t of p.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }

  const index = readJson<IssueIndexEntry[]>(join(dir, 'index.json'), []).filter((e) => e.date !== today);
  const issue: Issue = {
    edition: edition.slug,
    date: today,
    number: (index[0]?.number ?? 0) + 1,
    generatedAt: new Date().toISOString(),
    editor: {
      mode: usedLlm ? 'llm' : 'heuristic',
      ...(usedLlm && llm ? { model: llm.model } : {}),
      ...(editorNote ? { note: editorNote } : {}),
    },
    lede,
    readFirst,
    papers,
    dispatches,
    topics: [...topicCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    stats: {
      screened: pool.length,
      matched: eligible.length,
      alreadyFeatured,
      published: papers.length,
      ...(ctx.announcedOn ? { announcedOn: ctx.announcedOn } : {}),
    },
  };

  const lead = papers.filter((p) => p.tier === 'lead').length;
  console.log(`  ✓ No. ${issue.number}: ${papers.length} papers (${lead} lead), ${dispatches.length} dispatches, editor=${issue.editor.mode}`);
  console.log(`    “${lede?.headline ?? papers[0].title}”`);

  if (ctx.dryRun) {
    for (const p of papers.slice(0, 10)) {
      console.log(`    ${String(p.score).padStart(3)} ${p.llmScore ?? '-'}/10 h=${String(p.heuristicScore).padStart(5)} ${p.tier.padEnd(7)} ${p.title.slice(0, 80)}  [${p.topics.slice(0, 2).join(', ')}]`);
    }
  } else {
    for (const p of papers) seen[p.id] ??= today;
    for (const d of dispatches) seen[`d:${d.id}`] ??= today;
    writeJson(join(dir, 'issues', `${today}.json`), issue);
    writeJson(join(dir, 'latest.json'), issue);
    writeJson(join(dir, 'index.json'), [
      { date: today, number: issue.number, headline: lede?.headline ?? papers[0].title, published: papers.length },
      ...index,
    ]);
    writeJson(join(dir, 'seen.json'), seen);
  }
  return issue;
}

function writeManifest(settings: Settings, editions: EditionConfig[]) {
  const entries: EditionManifestEntry[] = editions.map((e) => {
    const index = readJson<IssueIndexEntry[]>(join(editionDir(e.slug), 'index.json'), []);
    return {
      slug: e.slug,
      name: e.name,
      order: e.order,
      tagline: e.tagline,
      accent: e.accent,
      latest: index[0]?.date ?? null,
      issues: index.length,
    };
  });
  const manifest: Manifest = { publicationName: settings.publicationName, updatedAt: new Date().toISOString(), editions: entries };
  writeJson(join(DATA_DIR, 'editions.json'), manifest);
}

async function main() {
  const settings = readJson<Settings>(join(CONFIG_DIR, 'settings.json'));
  const only = option('edition');
  const dryRun = flag('dry-run');
  const allEditions = loadEditions();
  const editions = allEditions.filter((e) => !only || e.slug === only);
  if (editions.length === 0) throw new Error(`Unknown edition "${only}"`);

  const today = todayUtc();
  const llm = flag('no-llm')
    ? null
    : createLlm(process.env.OPENROUTER_API_KEY, settings.openRouterModels, settings.openRouterMaxTokens);
  console.log(`=== ${settings.publicationName} · ${today} · ${editions.map((e) => e.slug).join(', ')} ===`);
  if (!llm) console.log('ℹ No LLM (missing OPENROUTER_API_KEY or --no-llm): heuristic ranking, no editor’s note.');

  // 1. arXiv — one request for the union of all editions' categories.
  const categories = [...new Set(editions.flatMap((e) => e.arxivCategories))];
  console.log(`\n📄 arXiv announcement for ${categories.length} categories`);
  const arxiv = await fetchArxiv(categories); // throws → job fails loudly instead of publishing an empty issue
  console.log(`  ${arxiv.totalEntries} entries · ${arxiv.replacementsDropped} revisions dropped · ${arxiv.papers.length} new/cross-listed · announced ${arxiv.announcedOn ?? '—'}`);

  // 2. Hugging Face Daily Papers — community signal (upvotes) + papers outside our categories.
  const hfDates = Array.from({ length: settings.huggingfaceDaysBack + 1 }, (_, i) =>
    todayUtc(new Date(Date.now() - i * 86_400_000)),
  );
  console.log(`\n🤗 Hugging Face Daily Papers (${hfDates.join(', ')})`);
  const hf = editions.some((e) => e.huggingface.enabled) ? await fetchHuggingFace(hfDates) : [];
  console.log(`  ${hf.length} papers`);

  const pool = mergeSources(arxiv.papers, hf);
  console.log(`\n🧮 Candidate pool: ${pool.length} papers (${pool.filter((p) => p.hf && p.sources.includes('arxiv')).length} on both)`);

  // 3. RSS dispatches
  const feedConfigs = readJson<{ feeds: FeedConfig[] }>(join(CONFIG_DIR, 'feeds.json')).feeds.filter((f) =>
    f.editions.some((slug) => editions.some((e) => e.slug === slug && e.dispatches.enabled)),
  );
  const feeds = await Promise.all(feedConfigs.map((f) => fetchFeed(f)));
  if (feeds.length) {
    console.log('\n📰 Dispatches');
    for (const f of feeds) console.log(`  ${f.error ? '✗' : '✓'} ${f.feed.name}: ${f.error ?? `${f.items.length} recent`}`);
  }

  // 4. Editions
  let published = 0;
  let searched = 0;
  for (const edition of editions) {
    if (flag('skip-existing') && existsSync(join(editionDir(edition.slug), 'issues', `${today}.json`))) {
      // Re-runs later in the day (e.g. to deploy site changes) keep the morning's issue
      // instead of spending the LLM quota again and possibly replacing it with a fallback.
      console.log(`\n━━ ${edition.name} ━━\n  ⏭ today's issue already exists (--skip-existing)`);
      continue;
    }
    let hits: CandidatePaper[] = [];
    if (edition.arxivQueries?.length) {
      // arXiv asks API clients to keep 3 s between requests.
      if (searched++ > 0) await new Promise((r) => setTimeout(r, 3500));
      try {
        hits = await fetchArxivSearch(edition.arxivQueries, settings.searchWindowDays ?? 5);
      } catch (error) {
        console.warn(`\n⚠ ${edition.name}: arXiv keyword search failed (${(error as Error).message}); using feeds only`);
      }
    }
    const issue = await buildEdition(edition, pool, hits, feeds, { today, settings, llm, announcedOn: arxiv.announcedOn, dryRun });
    if (issue) published++;
  }

  if (!dryRun) writeManifest(settings, allEditions);
  console.log(`\n✅ ${published}/${editions.length} editions published${dryRun ? ' (dry run — nothing written)' : ''}`);
}

main()
  // Explicit exit: keep-alive sockets would otherwise hold the process (and the CI job) open.
  .then(() => process.exit(0))
  .catch((error) => {
  console.error(error);
  process.exit(1);
});
