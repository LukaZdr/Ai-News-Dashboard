import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Paper, NewsItem, Video, GitHubRepo, NewsletterItem, ContentItem } from '@/types';

export function useSearch(
  papers: Paper[],
  news: NewsItem[],
  videos: Video[],
  github: GitHubRepo[],
  newsletters: NewsletterItem[]
) {
  const allItems: ContentItem[] = useMemo(() => [
    ...papers.map((data) => ({ type: 'paper' as const, data })),
    ...news.map((data) => ({ type: 'news' as const, data })),
    ...videos.map((data) => ({ type: 'video' as const, data })),
    ...github.map((data) => ({ type: 'github' as const, data })),
    ...newsletters.map((data) => ({ type: 'newsletter' as const, data })),
  ], [papers, news, videos, github, newsletters]);

  const fuse = useMemo(() => new Fuse(allItems, {
    keys: [
      { name: 'data.title', weight: 2 },
      { name: 'data.name', weight: 2 },
      { name: 'data.abstract', weight: 1 },
      { name: 'data.summary', weight: 1 },
      { name: 'data.description', weight: 1 },
      { name: 'data.channel', weight: 0.5 },
      { name: 'data.company', weight: 0.5 },
      { name: 'data.source', weight: 0.5 },
      { name: 'data.tags', weight: 1.5 },
      { name: 'data.authors', weight: 1 },
    ],
    threshold: 0.4,
    includeScore: true,
  }), [allItems]);

  const search = (query: string): ContentItem[] => {
    if (!query.trim()) return [];
    return fuse.search(query, { limit: 20 }).map((r) => r.item);
  };

  return { search, allItems };
}
