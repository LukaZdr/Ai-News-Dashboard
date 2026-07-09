/**
 * Fetch AI company news from RSS feeds.
 */
import 'dotenv/config';
import Parser from 'rss-parser';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  getConfigPath,
  getDataPath,
  isWithinTimeframe,
  deduplicateByField,
  autoTag,
} from './utils/index.js';
import type { NewsItem, CompanyConfig } from '../src/types/index.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AI-News-Dashboard/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

function classifyNewsType(
  title: string,
  content: string
): 'blog' | 'release' | 'api_update' | 'pricing' | 'announcement' {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('api') || text.includes('endpoint') || text.includes('sdk')) return 'api_update';
  if (text.includes('pricing') || text.includes('cost') || text.includes('free tier')) return 'pricing';
  if (text.includes('release') || text.includes('launch') || text.includes('introducing')) return 'release';
  if (text.includes('announce') || text.includes('announcement')) return 'announcement';
  return 'blog';
}

async function fetchCompanyNews(company: CompanyConfig, timeframeHours: number): Promise<NewsItem[]> {
  if (!company.blogRssUrl) {
    console.log(`  ⏭ Skipping ${company.name} (no RSS URL)`);
    return [];
  }

  console.log(`  📰 Fetching ${company.name}...`);

  try {
    const feed = await parser.parseURL(company.blogRssUrl);
    const items: NewsItem[] = [];

    for (const entry of feed.items || []) {
      const date = entry.pubDate || entry.isoDate || '';
      if (date && !isWithinTimeframe(date, timeframeHours)) continue;

      const title = entry.title || '';
      const content = entry.contentSnippet || entry.content || '';

      items.push({
        id: generateId(`${company.slug}-${entry.link || title}`),
        title,
        date,
        source: company.name,
        company: company.slug,
        url: entry.link || '',
        summary: content.substring(0, 300).replace(/<[^>]*>/g, ''),
        type: classifyNewsType(title, content),
        tags: autoTag(`${title} ${content}`),
        importance: 5,
      });
    }

    console.log(`    ✓ Found ${items.length} items`);
    return items;
  } catch (error) {
    console.warn(`    ⚠ Failed to fetch ${company.name}:`, (error as Error).message);
    return [];
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  const companiesConfig = readJsonFile<{ companies: CompanyConfig[] }>(getConfigPath('companies.json'));
  const settings = readJsonFile<{ timeframeHours: number }>(getConfigPath('settings.json'));

  const allNewsArrays = await Promise.allSettled(
    companiesConfig.companies.map((c) => fetchCompanyNews(c, settings.timeframeHours))
  );

  let allNews: NewsItem[] = [];
  for (const result of allNewsArrays) {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
    }
  }

  allNews = deduplicateByField(allNews, 'url');
  allNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  console.log(`\n📊 Total news items: ${allNews.length}`);
  return allNews;
}

// Main execution
async function main() {
  console.log('=== Fetching Company News ===\n');
  const news = await fetchNews();
  writeJsonFile(getDataPath('news.json'), news);
  console.log('\n✅ News fetch complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
