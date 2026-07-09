// ===== Core Data Models =====

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  date: string;
  source: 'arxiv' | 'huggingface' | 'company';
  url: string;
  abstract: string;
  tags: string[];
  importance: number;
  novelty: number;
  company?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  source: string;
  company: string;
  url: string;
  summary: string;
  type: 'blog' | 'release' | 'api_update' | 'pricing' | 'announcement';
  tags: string[];
  importance: number;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  date: string;
  duration: string;
  thumbnail: string;
  url: string;
  description: string;
  viewCount?: number;
  tags: string[];
  relevanceScore: number;
}

export interface GitHubRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  language?: string;
  latestRelease?: {
    tag: string;
    date: string;
    notes: string;
  };
  recentActivity: string;
  tags: string[];
}

export interface Development {
  rank: number;
  title: string;
  summary: string;
  whyItMatters: string;
  expectedImpact: string;
  relatedItemIds: string[];
  tags: string[];
}

export interface TopicCluster {
  topic: string;
  frequency: number;
  growth: 'rising' | 'stable' | 'declining';
  relatedPaperIds: string[];
  relatedVideoIds: string[];
  relatedNewsIds: string[];
  relatedRepoIds: string[];
  relatedNewsletterIds?: string[];
}

export interface NewsletterItem {
  id: string;
  title: string;
  date: string;
  source: string;
  url: string;
  summary: string;
  tags: string[];
  quality: number; // e.g. 5 for ⭐⭐⭐⭐⭐
  readTime?: string;
  content?: string;
}

export interface DailyDigest {
  date: string;
  generatedAt: string;
  model: string;
  summary?: string;
  topDevelopments: Development[];
  recommendedReadingOrder: string[];
  estimatedReadingTime: number;
  topicClusters: TopicCluster[];
  newsletters?: NewsletterItem[];
}

export interface TrendsData {
  date: string;
  topics: TopicCluster[];
}

// ===== Configuration Types =====

export interface SourceConfig {
  arxiv: {
    categories: string[];
    maxResults: number;
  };
  huggingface: {
    enabled: boolean;
    maxPapers: number;
  };
}

export interface YouTubeChannelConfig {
  name: string;
  channelId: string;
  weight: number;
}

export interface CompanyConfig {
  name: string;
  slug: string;
  blogRssUrl?: string;
  researchUrl?: string;
  color: string;
  icon?: string;
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  tags: string[];
}

export interface Settings {
  timeframeHours: number;
  maxItemsPerSection: number;
  openRouterModel: string;
  openRouterMaxTokens: number;
}

// ===== UI State Types =====

export interface Bookmark {
  itemId: string;
  itemType: 'paper' | 'news' | 'video' | 'github' | 'newsletter';
  savedAt: string;
}

export interface ReadStatus {
  itemId: string;
  readAt: string;
}

export interface UserPreferences {
  bookmarks: Bookmark[];
  readItems: ReadStatus[];
  selectedTopics: string[];
  darkMode: boolean;
}

// ===== All content items (for unified search/filter) =====

export type ContentItem =
  | { type: 'paper'; data: Paper }
  | { type: 'news'; data: NewsItem }
  | { type: 'video'; data: Video }
  | { type: 'github'; data: GitHubRepo }
  | { type: 'newsletter'; data: NewsletterItem };

// ===== Topic constants =====

export const ALL_TOPICS = [
  'Agents',
  'Reasoning',
  'LLMs',
  'Computer Vision',
  'Robotics',
  'AI Coding',
  'Open Source',
  'Research',
  'Business',
  'MCP',
  'RL',
  'Video Models',
  'Inference',
  'Memory',
  'RAG',
  'Synthetic Data',
] as const;

export type Topic = (typeof ALL_TOPICS)[number];

export interface ModelBenchmark {
  id: string;
  name: string;
  creator: string;
  type: 'open' | 'proprietary';
  arenaElo: number;
  codingElo: number;
  mmlu: number;
  inputPrice: number;
  outputPrice: number;
  license: string;
  strengths: string;
  agentSuccessRate?: number;
}
