import { useState, useEffect, useCallback } from 'react';
import type { Paper, NewsItem, Video, GitHubRepo, DailyDigest, TrendsData, NewsletterItem, ModelBenchmark } from '@/types';

const BASE_URL = import.meta.env.BASE_URL || '/';

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}data/${path}`);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json() as Promise<T>;
}

export function useData() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [github, setGithub] = useState<GitHubRepo[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<ModelBenchmark[]>([]);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('latest');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJson<string[]>('archive/index.json')
      .then(dates => setAvailableDates(dates.sort().reverse()))
      .catch(() => console.warn('No archive index found'));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const basePath = selectedDate === 'latest' ? '' : `archive/${selectedDate}/`;
      const [p, n, v, g, d, t, nl, b] = await Promise.allSettled([
        loadJson<Paper[]>(`${basePath}papers.json`),
        loadJson<NewsItem[]>(`${basePath}news.json`),
        loadJson<Video[]>(`${basePath}videos.json`),
        loadJson<GitHubRepo[]>(`${basePath}github.json`),
        loadJson<DailyDigest>(`${basePath}digest.json`),
        loadJson<TrendsData>(`${basePath}trends.json`),
        loadJson<NewsletterItem[]>(`${basePath}newsletters.json`),
        loadJson<ModelBenchmark[]>(`${basePath}benchmarks.json`),
      ]);
      if (p.status === 'fulfilled') setPapers(p.value);
      if (n.status === 'fulfilled') setNews(n.value);
      if (v.status === 'fulfilled') setVideos(v.value);
      if (g.status === 'fulfilled') setGithub(g.value);
      if (d.status === 'fulfilled' && d.value.date) setDigest(d.value);
      if (t.status === 'fulfilled' && t.value.date) setTrends(t.value);
      if (nl.status === 'fulfilled') setNewsletters(nl.value);
      if (b.status === 'fulfilled') setBenchmarks(b.value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  return { 
    papers, news, videos, github, newsletters, benchmarks, digest, trends, 
    loading, error, reload: loadData,
    availableDates, selectedDate, setSelectedDate 
  };
}
