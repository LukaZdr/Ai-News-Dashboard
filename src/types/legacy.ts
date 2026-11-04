// Shapes of the pre-November-2026 "AI Newspaper" data, kept read-only in data/legacy/.

export interface LegacyDevelopment {
  rank: number;
  title: string;
  summary: string;
  whyItMatters?: string;
  expectedImpact?: string;
}

export interface LegacyDigest {
  date: string;
  model: string;
  summary?: string;
  topDevelopments: LegacyDevelopment[];
}

export interface LegacyPaper {
  id: string;
  title: string;
  authors: string[];
  date: string;
  source: string;
  url: string;
  abstract: string;
}

export interface LegacyNews {
  id: string;
  title: string;
  date: string;
  source: string;
  url: string;
  summary: string;
}

export interface LegacyNewsletter {
  id: string;
  title: string;
  date: string;
  source: string;
  url: string;
  summary: string;
}

export interface LegacyVideo {
  id: string;
  title: string;
  channel: string;
  url: string;
  duration?: string;
}

export interface LegacyRepo {
  id: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  latestRelease?: { tag: string };
}

export interface LegacyDay {
  digest: LegacyDigest | null;
  papers: LegacyPaper[];
  news: LegacyNews[];
  newsletters: LegacyNewsletter[];
  videos: LegacyVideo[];
  repos: LegacyRepo[];
}
