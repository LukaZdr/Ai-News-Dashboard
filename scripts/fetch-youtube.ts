/**
 * Fetch AI videos from YouTube Data API v3.
 */
import 'dotenv/config';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  getConfigPath,
  getDataPath,
  autoTag,
  fetchWithRetry,
} from './utils/index.js';
import type { Video, YouTubeChannelConfig } from '../src/types/index.js';

const YT_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    description: string;
    thumbnails: {
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeVideoDetails {
  id: string;
  contentDetails: { duration: string };
  statistics: { viewCount: string };
}

function parseDuration(iso8601: string): string {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '0:00';
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function fetchChannelVideos(
  channel: YouTubeChannelConfig,
  apiKey: string,
  maxResults: number,
  publishedAfterHours: number
): Promise<Video[]> {
  console.log(`  🎬 Fetching ${channel.name}...`);

  const publishedAfter = new Date(Date.now() - publishedAfterHours * 3600000).toISOString();
  const searchUrl = `${YT_SEARCH_URL}?part=snippet&channelId=${channel.channelId}&type=video&order=date&maxResults=${maxResults}&publishedAfter=${publishedAfter}&key=${apiKey}`;

  try {
    const response = await fetchWithRetry(searchUrl);
    const data = await response.json() as { items: YouTubeSearchItem[] };

    if (!data.items?.length) {
      console.log(`    ✓ No new videos`);
      return [];
    }

    // Fetch video details for duration and view count
    const videoIds = data.items.map((i) => i.id.videoId).join(',');
    const detailsUrl = `${YT_VIDEOS_URL}?part=contentDetails,statistics&id=${videoIds}&key=${apiKey}`;
    const detailsResponse = await fetchWithRetry(detailsUrl);
    const detailsData = await detailsResponse.json() as { items: YouTubeVideoDetails[] };
    const detailsMap = new Map(detailsData.items?.map((d) => [d.id, d]) || []);

    const videos: Video[] = data.items.map((item) => {
      const details = detailsMap.get(item.id.videoId);
      const viewCount = details ? parseInt(details.statistics.viewCount || '0') : 0;

      // Compute relevance score based on freshness, channel weight, and views
      const ageHours = (Date.now() - new Date(item.snippet.publishedAt).getTime()) / 3600000;
      const freshnessScore = Math.max(0, 10 - ageHours / 4);
      const viewScore = Math.min(10, Math.log10(viewCount + 1) * 2);
      const relevanceScore = Math.round(
        (freshnessScore * 0.3 + channel.weight * 0.4 + viewScore * 0.3) * 10
      ) / 10;

      return {
        id: generateId(`yt-${item.id.videoId}`),
        title: item.snippet.title,
        channel: item.snippet.channelTitle || channel.name,
        channelId: channel.channelId,
        date: item.snippet.publishedAt,
        duration: details ? parseDuration(details.contentDetails.duration) : '0:00',
        thumbnail:
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          '',
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description.substring(0, 300),
        viewCount,
        tags: autoTag(`${item.snippet.title} ${item.snippet.description}`),
        relevanceScore,
      };
    });

    console.log(`    ✓ Found ${videos.length} videos`);
    return videos;
  } catch (error) {
    console.warn(`    ⚠ Failed to fetch ${channel.name}:`, (error as Error).message);
    return [];
  }
}

export async function fetchYouTube(): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('  ✗ YOUTUBE_API_KEY not set!');
    return [];
  }

  const config = readJsonFile<{
    channels: YouTubeChannelConfig[];
    maxResultsPerChannel: number;
    publishedAfterHours: number;
  }>(getConfigPath('youtube.json'));

  const allVideoArrays = await Promise.allSettled(
    config.channels.map((c) =>
      fetchChannelVideos(c, apiKey, config.maxResultsPerChannel, config.publishedAfterHours)
    )
  );

  let allVideos: Video[] = [];
  for (const result of allVideoArrays) {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value);
    }
  }

  // Sort by relevance score
  allVideos.sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(`\n📊 Total videos: ${allVideos.length}`);
  return allVideos;
}

// Main execution
async function main() {
  console.log('=== Fetching YouTube Videos ===\n');
  const videos = await fetchYouTube();
  writeJsonFile(getDataPath('videos.json'), videos);
  console.log('\n✅ YouTube fetch complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
