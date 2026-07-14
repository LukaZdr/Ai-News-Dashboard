/**
 * Lightweight web content crawler for enriching digest context.
 * Fetches article URLs and extracts main body text without heavy
 * dependencies like Puppeteer. Rate-limited and fault-tolerant.
 */
import { fetchWithRetry } from './index.js';

/**
 * Convert raw HTML to clean plaintext, preserving paragraph structure.
 */
function htmlToPlaintext(html: string): string {
  let text = html;

  // Remove script, style, noscript blocks entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Remove nav, header, footer, sidebar elements (boilerplate)
  text = text.replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Convert block elements to newlines
  text = text.replace(/<\/?(p|div|section|article|main|figure|figcaption)[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(h[1-6])[^>]*>/gi, '\n');
  text = text.replace(/<\/(li|tr|dt|dd)>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<blockquote[^>]*>/gi, '\n> ');
  text = text.replace(/<\/blockquote>/gi, '\n');
  text = text.replace(/<hr[^>]*>/gi, '\n---\n');

  // Keep alt text from images
  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '[$1]');
  text = text.replace(/<img[^>]*>/gi, '');

  // Keep link text, drop href
  text = text.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&hellip;/g, '…');
  text = text.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)));

  // Clean up whitespace
  text = text.replace(/[^\S\n]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(line => line.trim()).join('\n');
  text = text.trim();

  return text;
}

/**
 * Attempt to extract the "main content" area from an HTML page.
 * Uses heuristics: looks for <article>, <main>, or the largest
 * text-dense block in the page.
 */
function extractMainContent(html: string): string {
  // Try to find <article> tag content first (most blogs use this)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    return htmlToPlaintext(articleMatch[1]);
  }

  // Try <main> tag
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return htmlToPlaintext(mainMatch[1]);
  }

  // Try common content class names
  const contentPatterns = [
    /<div[^>]*class="[^"]*(?:post-content|entry-content|article-content|prose|post-body|blog-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:content|post|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      return htmlToPlaintext(match[1]);
    }
  }

  // Fallback: extract from <body> and strip boilerplate
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return htmlToPlaintext(bodyMatch[1]);
  }

  // Last resort: convert entire HTML
  return htmlToPlaintext(html);
}

export interface CrawledContent {
  url: string;
  text: string;
  success: boolean;
  error?: string;
}

/**
 * Crawl a single URL and extract its main body text.
 * Returns at most `maxChars` characters of content.
 */
async function crawlUrl(url: string, maxChars = 2000): Promise<CrawledContent> {
  try {
    // Skip non-http URLs
    if (!url.startsWith('http')) {
      return { url, text: '', success: false, error: 'Not an HTTP URL' };
    }

    // Skip known non-article URLs
    const skipPatterns = [
      /github\.com\/[^/]+\/[^/]+$/,  // GitHub repos (not article pages)
      /youtube\.com|youtu\.be/,
      /\.pdf$/i,
      /example\.com/,
      /twitter\.com|x\.com/,
    ];
    if (skipPatterns.some(p => p.test(url))) {
      return { url, text: '', success: false, error: 'Skipped URL type' };
    }

    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'AI-News-Dashboard/1.0 (content enrichment)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 2); // 2 retries for crawling

    const html = await response.text();
    const content = extractMainContent(html);

    // Trim to maxChars at a sentence boundary
    let trimmed = content.substring(0, maxChars);
    if (content.length > maxChars) {
      const lastPeriod = trimmed.lastIndexOf('. ');
      const lastNewline = trimmed.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      if (cutPoint > maxChars * 0.5) {
        trimmed = trimmed.substring(0, cutPoint + 1);
      }
      trimmed += '…';
    }

    if (trimmed.length < 50) {
      return { url, text: '', success: false, error: 'Content too short (likely paywall or JS-rendered)' };
    }

    return { url, text: trimmed, success: true };
  } catch (error) {
    return { url, text: '', success: false, error: (error as Error).message };
  }
}

/**
 * Crawl multiple URLs with rate limiting.
 * @param urls - Array of URLs to crawl
 * @param maxChars - Max characters to extract per URL
 * @param delayMs - Delay between requests (rate limiting)
 * @param concurrency - Max concurrent requests
 */
export async function crawlUrls(
  urls: string[],
  maxChars = 2000,
  delayMs = 800,
  concurrency = 3,
): Promise<CrawledContent[]> {
  const results: CrawledContent[] = [];
  const queue = [...urls];

  console.log(`  🌐 Crawling ${queue.length} URLs for context enrichment...`);

  // Process in batches of `concurrency`
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(url => crawlUrl(url, maxChars))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          console.log(`    ✓ Crawled: ${result.value.url.substring(0, 80)}... (${result.value.text.length} chars)`);
        }
      } else {
        console.warn(`    ⚠ Crawl failed: ${result.reason}`);
      }
    }

    // Rate limit between batches
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`  📊 Crawl complete: ${successCount}/${results.length} URLs succeeded`);

  return results;
}
