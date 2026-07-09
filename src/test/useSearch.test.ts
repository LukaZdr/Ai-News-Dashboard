import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSearch } from '../hooks/useSearch';
import type { Paper, NewsItem, NewsletterItem } from '../types';

const mockPapers: Paper[] = [
  {
    id: 'p1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani'],
    date: '2017-06-12',
    source: 'arxiv',
    url: 'https://arxiv.org/abs/1706.03762',
    abstract: 'We propose a new simple network architecture, the Transformer...',
    tags: ['LLMs', 'Research'],
    importance: 10,
    novelty: 10,
  },
];

const mockNews: NewsItem[] = [
  {
    id: 'n1',
    title: 'Claude 3.5 Sonnet Release',
    date: '2024-06-20',
    source: 'Anthropic',
    company: 'anthropic',
    url: 'https://anthropic.com/claude',
    summary: 'Our most intelligent model yet setting industry benchmarks...',
    type: 'release',
    tags: ['LLMs', 'Agents'],
    importance: 9,
  },
];

const mockNewsletters: NewsletterItem[] = [
  {
    id: 'nl1',
    title: 'The Future of AI Coding',
    date: '2024-06-21',
    source: 'The Batch',
    url: 'https://deeplearning.ai/the-batch',
    summary: 'An exploration of agentic workflows and developer productivity...',
    tags: ['AI Coding', 'Agents'],
    quality: 5,
  },
];

describe('useSearch Hook', () => {
  it('combines all content items correctly', () => {
    const { result } = renderHook(() => useSearch(mockPapers, mockNews, [], [], mockNewsletters));

    expect(result.current.allItems).toHaveLength(3);
    expect(result.current.allItems[0]).toEqual({ type: 'paper', data: mockPapers[0] });
    expect(result.current.allItems[1]).toEqual({ type: 'news', data: mockNews[0] });
    expect(result.current.allItems[2]).toEqual({ type: 'newsletter', data: mockNewsletters[0] });
  });

  it('performs fuzzy matching using search query', () => {
    const { result } = renderHook(() => useSearch(mockPapers, mockNews, [], [], mockNewsletters));

    // Exact word matching in title
    const matches = result.current.search('Attention');
    expect(matches).toHaveLength(1);
    expect(matches[0].data.id).toBe('p1');

    // Matching in author
    const authorMatches = result.current.search('Vaswani');
    expect(authorMatches).toHaveLength(1);
    expect(authorMatches[0].data.id).toBe('p1');

    // Matching tags/keywords
    const tagMatches = result.current.search('Sonnet');
    expect(tagMatches).toHaveLength(1);
    expect(tagMatches[0].data.id).toBe('n1');

    // Newsletter source matching
    const sourceMatches = result.current.search('The Batch');
    expect(sourceMatches).toHaveLength(1);
    expect(sourceMatches[0].data.id).toBe('nl1');

    // Return empty array for empty search query
    expect(result.current.search('')).toEqual([]);
  });
});
