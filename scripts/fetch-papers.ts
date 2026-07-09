/**
 * Fetch AI research papers from arXiv RSS feeds and HuggingFace Daily Papers.
 */
import 'dotenv/config';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  getConfigPath,
  getDataPath,
  isWithinTimeframe,
  deduplicateByField,
  autoTag,
  fetchWithRetry,
} from './utils/index.js';
import type { Paper, SourceConfig } from '../src/types/index.js';

const ARXIV_RSS_BASE = 'https://rss.arxiv.org/atom/';
const HF_DAILY_PAPERS = 'https://huggingface.co/api/daily_papers';

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  author: { name: string } | { name: string }[];
  published: string;
  link: { '@_href': string } | { '@_href': string }[];
}

async function fetchArxivPapers(categories: string[], maxResults: number): Promise<Paper[]> {
  console.log('📄 Fetching arXiv papers...');
  const categoryStr = categories.join('+').toLowerCase();
  const url = `${ARXIV_RSS_BASE}${categoryStr}`;

  try {
    const response = await fetchWithRetry(url);
    const xml = await response.text();

    // Simple XML parsing for Atom feeds
    const papers: Paper[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null && papers.length < maxResults) {
      const entry = match[1];
      const title = extractTag(entry, 'title')?.replace(/\n/g, ' ').trim() || '';
      const summary = extractTag(entry, 'summary')?.replace(/\n/g, ' ').trim() || '';
      const published = extractTag(entry, 'published') || extractTag(entry, 'updated') || '';
      const id = extractTag(entry, 'id') || '';

      // Extract authors
      const authorRegex = /<author>\s*<name>(.*?)<\/name>/g;
      const authors: string[] = [];
      let authorMatch;
      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        authors.push(authorMatch[1].trim());
      }

      // Extract link
      const linkMatch = entry.match(/href="(https?:\/\/arxiv\.org\/abs\/[^"]+)"/);
      const url = linkMatch ? linkMatch[1] : id;

      if (title) {
        papers.push({
          id: generateId(url || title),
          title,
          authors,
          date: published,
          source: 'arxiv',
          url,
          abstract: summary.substring(0, 500),
          tags: autoTag(`${title} ${summary}`),
          importance: 5,
          novelty: 5,
        });
      }
    }

    console.log(`  ✓ Found ${papers.length} arXiv papers`);
    return papers;
  } catch (error) {
    console.error('  ✗ Failed to fetch arXiv papers:', error);
    return [];
  }
}

async function fetchHuggingFacePapers(maxPapers: number): Promise<Paper[]> {
  console.log('🤗 Fetching HuggingFace Daily Papers...');

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const papers: Paper[] = [];

    for (const date of [today, yesterday]) {
      const url = `${HF_DAILY_PAPERS}?date=${date}&limit=${maxPapers}`;
      try {
        const response = await fetchWithRetry(url);
        const data = await response.json() as Array<{
          paper: {
            id: string;
            title: string;
            summary: string;
            authors: Array<{ name: string }>;
          };
          publishedAt: string;
          title?: string;
        }>;

        for (const item of data) {
          const paper = item.paper;
          if (!paper) continue;

          papers.push({
            id: generateId(`hf-${paper.id}`),
            title: paper.title || '',
            authors: paper.authors?.map((a) => a.name) || [],
            date: item.publishedAt || date,
            source: 'huggingface',
            url: `https://huggingface.co/papers/${paper.id}`,
            abstract: (paper.summary || '').substring(0, 500),
            tags: autoTag(`${paper.title} ${paper.summary || ''}`),
            importance: 6,
            novelty: 6,
          });
        }
      } catch {
        console.warn(`  ⚠ Failed to fetch HF papers for ${date}`);
      }
    }

    console.log(`  ✓ Found ${papers.length} HuggingFace papers`);
    return papers;
  } catch (error) {
    console.error('  ✗ Failed to fetch HuggingFace papers:', error);
    return [];
  }
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

export async function fetchPapers(): Promise<Paper[]> {
  const config = readJsonFile<SourceConfig>(getConfigPath('sources.json'));
  const settings = readJsonFile<{ timeframeHours: number }>(getConfigPath('settings.json'));

  const [arxivPapers, hfPapers] = await Promise.all([
    fetchArxivPapers(config.arxiv.categories, config.arxiv.maxResults),
    config.huggingface.enabled
      ? fetchHuggingFacePapers(config.huggingface.maxPapers)
      : Promise.resolve([]),
  ]);

  let allPapers = [...arxivPapers, ...hfPapers];

  // Deduplicate by title similarity (normalize whitespace)
  allPapers = deduplicateByField(
    allPapers.map((p) => ({ ...p, _normTitle: p.title.toLowerCase().replace(/\s+/g, ' ') })),
    '_normTitle' as keyof typeof allPapers[0]
  ).map(({ ...p }) => {
    const { _normTitle: _, ...paper } = p as typeof p & { _normTitle: string };
    return paper as Paper;
  });

  // Filter by timeframe
  allPapers = allPapers.filter((p) => {
    if (!p.date) return true;
    return isWithinTimeframe(p.date, settings.timeframeHours);
  });

  console.log(`\n📊 Total papers after dedup & filtering: ${allPapers.length}`);
  return allPapers;
}

// Main execution
async function main() {
  console.log('=== Fetching Papers ===\n');
  const papers = await fetchPapers();
  writeJsonFile(getDataPath('papers.json'), papers);
  console.log('\n✅ Papers fetch complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
