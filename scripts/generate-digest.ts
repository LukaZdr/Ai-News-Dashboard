/**
 * Generate AI digest using OpenRouter LLM. Reads all collected data,
 * sends metadata to the LLM, and writes digest.json and trends.json.
 */
import 'dotenv/config';
import {
  readJsonFile,
  writeJsonFile,
  getConfigPath,
  getDataPath,
  fetchWithRetry,
  extractTerms,
} from './utils/index.js';
import {
  loadHistoricalDF,
  saveHistoricalDF,
  updateHistoricalDF,
  trackCasing,
  getBestCasing,
  computeTFIDF,
} from './utils/tfidf.js';
import type { Paper, NewsItem, Video, GitHubRepo, DailyDigest, TrendsData, TopicCluster, NewsletterItem } from '../src/types/index.js';
import { mkdirSync, existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt(papers: Paper[], news: NewsItem[], videos: Video[], repos: GitHubRepo[], newsletters: NewsletterItem[]): string {
  const paperSummary = papers.slice(0, 30).map((p, i) =>
    `${i + 1}. [ID: ${p.id}] "${p.title}" [${p.source}] tags: ${p.tags.join(', ')}`
  ).join('\n');

  const newsSummary = news.slice(0, 20).map((n, i) =>
    `${i + 1}. [ID: ${n.id}] "${n.title}" by ${n.company} [${n.type}] tags: ${n.tags.join(', ')}`
  ).join('\n');

  const videoSummary = videos.slice(0, 15).map((v, i) =>
    `${i + 1}. [ID: ${v.id}] "${v.title}" by ${v.channel} tags: ${v.tags.join(', ')}`
  ).join('\n');

  const repoSummary = repos.slice(0, 10).map((r, i) =>
    `${i + 1}. [ID: ${r.id}] ${r.fullName} (⭐${r.stars}) - ${r.latestRelease?.tag || 'no release'}`
  ).join('\n');

  const newsletterSummary = newsletters.slice(0, 15).map((nl, i) =>
    `${i + 1}. [ID: ${nl.id}] "${nl.title}" by ${nl.source} (Quality rating: ${nl.quality}/5) tags: ${nl.tags.join(', ')}`
  ).join('\n');

  return `You are an AI research analyst. Analyze the following AI developments from the last 24-48 hours and produce a structured daily digest report.

Your primary task is to identify and select the 3 to 5 most significant/important developments from all the lists below. Do not pick randomly. Evaluate and prioritize based on these criteria:
- COMPANY NEWS: Announcements from leading AI labs (such as OpenAI, Anthropic, Google, NVIDIA, Meta) regarding new models, API updates, or major products are extremely high priority.
- GITHUB REPOS: Active or newly trending open-source repositories with high stars (⭐) or significant package releases.
- PAPERS: High-impact AI research papers. Prioritize HuggingFace Daily Papers (Community interest/importance score: 6) and significant arXiv papers.
- NEWSLETTERS: Key commentary, research summaries, and strategic reports from top-tier newsletters (e.g. The Batch, Import AI, Latent Space, Interconnects, Simon Willison).
- VIDEOS: Highly informative/explanation breakthroughs from trusted channels.

PAPERS (${papers.length} total):
${paperSummary || 'None collected'}

COMPANY NEWS (${news.length} total):
${newsSummary || 'None collected'}

YOUTUBE VIDEOS (${videos.length} total):
${videoSummary || 'None collected'}

GITHUB REPOS (${repos.length} total):
${repoSummary || 'None collected'}

NEWSLETTERS (${newsletters.length} total):
${newsletterSummary || 'None collected'}

Respond with ONLY valid JSON matching this structure:
{
  "summary": "A cohesive executive summary (1-2 paragraphs, ~150-250 words) of the day's key AI developments, trends, and implications. Write in a professional, analyst-style narrative that unifies today's AI landscape.",
  "topDevelopments": [
    {
      "rank": 1,
      "title": "Brief title of this specific development",
      "summary": "2-3 sentence summary synthesizing the development",
      "whyItMatters": "Why this is important and why this card was picked (1 sentence)",
      "expectedImpact": "Expected impact on the AI field (1 sentence)",
      "relatedItemIds": ["id1", "id2"],
      "tags": ["tag1", "tag2"]
    }
  ],
  "recommendedReadingOrder": ["item title 1", "item title 2"],
  "estimatedReadingTime": 15
}

Rules:
- Include 3-5 top developments
- Keep summaries concise
- estimatedReadingTime is in minutes
- In "relatedItemIds", include the exact string ID(s) (e.g. "a6f419975d72") from the source list that directly refer or relate to that development. This acts as a citation/reference link.`;
}

function generateTopicClusters(
  papers: Paper[],
  news: NewsItem[],
  videos: Video[],
  repos: GitHubRepo[],
  newsletters: NewsletterItem[]
): TopicCluster[] {
  const dfPath = getDataPath('historical-df.json');
  const historicalDF = loadHistoricalDF(dfPath);

  const todayDocumentsTerms: string[][] = [];
  const casingMap: Record<string, Record<string, number>> = {};

  const processItemText = (
    title: string,
    desc: string,
    tags: string[],
    itemId: string,
    type: 'paper' | 'news' | 'video' | 'repo' | 'newsletter'
  ) => {
    const text = `${title} ${desc} ${tags.join(' ')}`;
    const terms = extractTerms(text);
    trackCasing(text, terms, casingMap);
    todayDocumentsTerms.push(terms);
    return { id: itemId, type, terms };
  };

  const allItems = [
    ...papers.map(p => processItemText(p.title, p.abstract || '', p.tags || [], p.id, 'paper')),
    ...news.map(n => processItemText(n.title, n.summary || '', n.tags || [], n.id, 'news')),
    ...videos.map(v => processItemText(v.title, '', v.tags || [], v.id, 'video')),
    ...repos.map(r => processItemText(r.name, r.description || '', r.tags || [], r.id, 'repo')),
    ...newsletters.map(nl => processItemText(nl.title, nl.summary || '', nl.tags || [], nl.id, 'newsletter')),
  ];

  if (todayDocumentsTerms.length === 0) {
    return [];
  }

  // Update historical DF dictionary
  updateHistoricalDF(todayDocumentsTerms, historicalDF);
  saveHistoricalDF(dfPath, historicalDF);

  // Compute TF-IDF
  const tfidfScores = computeTFIDF(todayDocumentsTerms, historicalDF);

  // We take the top 10 unique terms/phrases as today's topics
  const topTopics = tfidfScores.slice(0, 10);

  const topicClusters = topTopics.map(({ term }) => {
    const relatedPaperIds: string[] = [];
    const relatedVideoIds: string[] = [];
    const relatedNewsIds: string[] = [];
    const relatedRepoIds: string[] = [];
    const relatedNewsletterIds: string[] = [];

    let todayCount = 0;

    for (const item of allItems) {
      if (item.terms.includes(term)) {
        todayCount++;
        if (item.type === 'paper') relatedPaperIds.push(item.id);
        else if (item.type === 'news') relatedNewsIds.push(item.id);
        else if (item.type === 'video') relatedVideoIds.push(item.id);
        else if (item.type === 'repo') relatedRepoIds.push(item.id);
        else if (item.type === 'newsletter') relatedNewsletterIds.push(item.id);
      }
    }

    // Growth calculation: ratio = count / total documents in the respective corpus
    const todayTotalDocs = todayDocumentsTerms.length;
    const todayRatio = todayTotalDocs > 0 ? todayCount / todayTotalDocs : 0;

    const histFreq = historicalDF.frequencies[term] || 1;
    const histTotal = historicalDF.totalDocuments || 1;
    const historicalRatio = histFreq / histTotal;

    let growth: 'rising' | 'stable' | 'declining' = 'stable';
    if (historicalDF.totalDocuments > todayTotalDocs) {
      const ratioOfRatios = todayRatio / (historicalRatio || 1);
      if (ratioOfRatios > 1.2) {
        growth = 'rising';
      } else if (ratioOfRatios < 0.8) {
        growth = 'declining';
      }
    } else {
      growth = todayCount > 1 ? 'rising' : 'stable';
    }

    return {
      topic: getBestCasing(term, casingMap),
      frequency: todayCount,
      growth,
      relatedPaperIds,
      relatedVideoIds,
      relatedNewsIds,
      relatedRepoIds,
      relatedNewsletterIds,
    };
  });

  return topicClusters;
}

function generateDynamicFallbackSummary(
  topDevs: any[],
  papers: Paper[],
  news: NewsItem[],
  repos: GitHubRepo[],
  newsletters: NewsletterItem[],
  topicClusters: any[]
): string {
  if (topDevs.length === 0) {
    return "No significant developments were identified in the last 24 hours.";
  }

  const keyTrends = topicClusters.slice(0, 3).map(c => c.topic);
  const trendStr = keyTrends.length > 0 
    ? `particularly centered around **${keyTrends.slice(0, -1).join(', ')}** and **${keyTrends[keyTrends.length - 1]}**`
    : "across the broader AI landscape";

  let summary = `### Daily Technical Landscape\n\n`;
  summary += `Today's analysis reveals active research and development, ${trendStr}. Our heuristics selected **${topDevs.length} key developments** from a pool of **${papers.length} publications**, **${news.length} announcements**, **${repos.length} codebases**, and **${newsletters.length} expert newsletter commentaries**.\n\n`;

  if (papers.length > 0) {
    summary += `### Research Focus & Architectural Insights\n\n`;
    const topResearch = papers.slice(0, 3);
    topResearch.forEach((p, idx) => {
      const abstractExcerpt = p.abstract 
        ? p.abstract.replace(/\s+/g, ' ').substring(0, 320).trim() + '...' 
        : 'No abstract excerpt available.';
      summary += `${idx + 1}. **${p.title}** (${p.source.toUpperCase()})\n`;
      summary += `   - **Core Findings**: ${abstractExcerpt}\n`;
      summary += `   - **Scientific Relevance**: Explores advanced paradigms in *${p.tags.join(', ')}* (proposed by *${p.authors.slice(0, 3).join(', ')}*).\n\n`;
    });
  }

  if (newsletters.length > 0) {
    summary += `### Newsletter Perspectives & Industry Commentary\n\n`;
    const topNewsletters = newsletters.slice(0, 3);
    topNewsletters.forEach((nl, idx) => {
      const starsStr = '★'.repeat(nl.quality) + '☆'.repeat(5 - nl.quality);
      summary += `${idx + 1}. **${nl.title}** (by *${nl.source}* - Rating: ${starsStr})\n`;
      summary += `   - **Analysis**: ${nl.summary}\n`;
      summary += `   - **Key Focus Areas**: *${nl.tags.join(', ')}*\n\n`;
    });
  }

  if (news.length > 0 || repos.length > 0) {
    summary += `### Engineering & System Deployments\n\n`;
    if (news.length > 0) {
      const topNews = news.slice(0, 2);
      topNews.forEach(item => {
        const descExcerpt = item.summary 
          ? item.summary.replace(/\s+/g, ' ').substring(0, 200).trim() + '...'
          : 'No description available.';
        summary += `- **${item.title}** (${item.source}): ${descExcerpt} (Tagged: *${item.tags.join(', ')}*)\n`;
      });
    }
    if (repos.length > 0) {
      const topRepo = repos[0];
      summary += `- **${topRepo.fullName}** (⭐${topRepo.stars.toLocaleString()}): ${topRepo.description || 'No description available.'} (Latest tag: \`${topRepo.latestRelease?.tag || 'N/A'}\`)\n`;
    }
  }

  return summary;
}

export async function generateDigest(): Promise<{ digest: DailyDigest; trends: TrendsData }> {
  const settings = readJsonFile<{ openRouterModel: string; openRouterMaxTokens: number }>(
    getConfigPath('settings.json')
  );

  const papers = readJsonFile<Paper[]>(getDataPath('papers.json'));
  const news = readJsonFile<NewsItem[]>(getDataPath('news.json'));
  const videos = readJsonFile<Video[]>(getDataPath('videos.json'));
  const repos = readJsonFile<GitHubRepo[]>(getDataPath('github.json'));
  
  let newsletters: NewsletterItem[] = [];
  try {
    newsletters = readJsonFile<NewsletterItem[]>(getDataPath('newsletters.json'));
  } catch {
    console.warn('  ⚠️ No newsletters.json found. Proceeding with empty newsletters.');
  }

  // Heuristically rank/sort items to push high-signal ones to the front
  papers.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  news.sort((a, b) => {
    if (b.importance !== a.importance) return b.importance - a.importance;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  videos.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    return (b.viewCount || 0) - (a.viewCount || 0);
  });

  repos.sort((a, b) => b.stars - a.stars);

  newsletters.sort((a, b) => {
    if (b.quality !== a.quality) return b.quality - a.quality;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  console.log(`📊 Data summary: ${papers.length} papers, ${news.length} news, ${videos.length} videos, ${repos.length} repos, ${newsletters.length} newsletters`);

  console.log('📝 Calculating TF-IDF topic clusters...');
  const topicClusters = generateTopicClusters(papers, news, videos, repos, newsletters);
  console.log(`  ✓ Extracted ${topicClusters.length} topic clusters`);

  let parsed;
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

    const prompt = buildPrompt(papers, news, videos, repos, newsletters);
    console.log(`\n🤖 Calling OpenRouter (${settings.openRouterModel})...`);

    const response = await fetchWithRetry(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ai-news-dashboard',
        'X-Title': 'AI News Dashboard',
      },
      body: JSON.stringify({
        model: settings.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: settings.openRouterMaxTokens,
        temperature: 0.3,
      }),
    });

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices?.[0]?.message?.content || '';
    console.log(`  ✓ Response received (${content.length} chars)`);

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    parsed = JSON.parse(jsonMatch[1]!.trim());
    parsed.topicClusters = topicClusters;
  } catch (error) {
    console.warn(`  ⚠ OpenRouter API call or parsing failed: ${(error as Error).message}`);
    console.log('  👉 Generating local fallback digest from fetched content...');

    const topDevs = [];

    // 1. Let's add top company updates
    const topNews = news.slice(0, 2);
    for (let i = 0; i < topNews.length; i++) {
      const item = topNews[i];
      topDevs.push({
        rank: topDevs.length + 1,
        title: item.title,
        summary: item.summary || `A new update from ${item.company}.`,
        whyItMatters: `This represents a major development from ${item.company} in the AI space.`,
        expectedImpact: `Accelerates developer tooling and application capability.`,
        relatedItemIds: [item.id],
        tags: item.tags.slice(0, 2),
      });
    }

    // 2. Let's add top papers
    const topPapers = papers.slice(0, 2);
    for (let i = 0; i < topPapers.length; i++) {
      const paper = topPapers[i];
      topDevs.push({
        rank: topDevs.length + 1,
        title: paper.title,
        summary: paper.abstract ? paper.abstract.substring(0, 150) + '...' : `A new research paper published on ${paper.source}.`,
        whyItMatters: `Published on ${paper.source} with tags: ${paper.tags.join(', ')}.`,
        expectedImpact: `Advances the theoretical and practical foundations of ${paper.tags[0] || 'AI'}.`,
        relatedItemIds: [paper.id],
        tags: paper.tags.slice(0, 2),
      });
    }

    // 3. Let's add top newsletters
    const topNl = newsletters.slice(0, 1);
    for (let i = 0; i < topNl.length; i++) {
      const nl = topNl[i];
      topDevs.push({
        rank: topDevs.length + 1,
        title: nl.title,
        summary: nl.summary || `Recent commentary from ${nl.source}.`,
        whyItMatters: `Analytical perspective from ${nl.source} (${'⭐'.repeat(nl.quality)} rating).`,
        expectedImpact: `Synthesizes critical developments for the AI ecosystem.`,
        relatedItemIds: [nl.id],
        tags: nl.tags.slice(0, 2),
      });
    }

    parsed = {
      summary: generateDynamicFallbackSummary(topDevs, papers, news, repos, newsletters, topicClusters),
      topDevelopments: topDevs,
      topicClusters: topicClusters,
      recommendedReadingOrder: topDevs.map(d => d.title),
      estimatedReadingTime: Math.max(5, Math.round(topDevs.length * 2.5)),
    };
  }

  const today = new Date().toISOString().split('T')[0];

  const digest: DailyDigest = {
    date: today!,
    generatedAt: new Date().toISOString(),
    model: parsed.topDevelopments.length > 0 && !parsed.topDevelopments[0].summary.includes('fallback') ? settings.openRouterModel : 'local-fallback',
    summary: parsed.summary,
    topDevelopments: parsed.topDevelopments || [],
    recommendedReadingOrder: parsed.recommendedReadingOrder || [],
    estimatedReadingTime: parsed.estimatedReadingTime || 10,
    topicClusters: parsed.topicClusters || [],
    newsletters: newsletters,
  };

  const trends: TrendsData = {
    date: today!,
    topics: parsed.topicClusters || [],
  };

  return { digest, trends };
}

function archiveData(date: string) {
  const archiveBase = getDataPath('archive');
  const archiveDir = join(archiveBase, date);
  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true });
  const files = ['papers.json', 'news.json', 'videos.json', 'github.json', 'newsletters.json', 'digest.json', 'trends.json', 'benchmarks.json'];
  for (const f of files) {
    const src = getDataPath(f);
    if (existsSync(src)) {
      copyFileSync(src, join(archiveDir, f));
    }
  }
  
  const indexPath = join(archiveBase, 'index.json');
  let index: string[] = [];
  try {
    if (existsSync(indexPath)) {
      index = JSON.parse(readFileSync(indexPath, 'utf-8'));
    }
  } catch (e) {
    // Ignore parse errors and start fresh
  }
  
  if (!index.includes(date)) {
    index.push(date);
    index.sort();
    writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
  
  console.log(`  ✓ Archived data to ${archiveDir} and updated index`);
}

async function main() {
  console.log('=== Generating AI Digest ===\n');
  const { digest, trends } = await generateDigest();
  writeJsonFile(getDataPath('digest.json'), digest);
  writeJsonFile(getDataPath('trends.json'), trends);
  archiveData(digest.date);
  console.log('\n✅ Digest generation complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
