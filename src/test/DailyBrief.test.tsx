import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyBrief } from '../components/sections/DailyBrief';
import type { DailyDigest, Paper } from '../types';

const mockDigest: DailyDigest = {
  date: '2026-07-08',
  generatedAt: new Date().toISOString(),
  model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  estimatedReadingTime: 5,
  summary: 'This is a cohesive executive summary paragraph of the day.',
  topDevelopments: [
    {
      rank: 1,
      title: 'Agentic Workflows are Rising',
      summary: 'Automated agents are dominating open-source development.',
      whyItMatters: 'Makes AI systems fully autonomous.',
      expectedImpact: 'Reduces software engineering overhead.',
      relatedItemIds: ['item-1'],
      tags: ['Agents', 'Open Source'],
    },
  ],
  recommendedReadingOrder: ['Agentic Workflows are Rising'],
  topicClusters: [],
};

const mockPapers: Paper[] = [
  {
    id: 'item-1',
    title: 'Reference Paper 1',
    authors: ['Author A'],
    date: '2026-07-08',
    source: 'arxiv',
    url: 'https://example.com/paper-1',
    abstract: 'Abstract text',
    tags: ['Agents'],
    importance: 4,
    novelty: 4,
  },
];

describe('DailyBrief Component', () => {
  it('renders loading skeletons when loading is true', () => {
    render(<DailyBrief digest={null} loading={true} />);
    const section = screen.getByRole('region', { hidden: true });
    expect(section).toBeInTheDocument();
  });

  it('renders fallback notice when digest is empty or null', () => {
    render(<DailyBrief digest={null} loading={false} />);
    expect(screen.getByText(/No digest available yet/i)).toBeInTheDocument();
  });

  it('renders top developments details, executive summary, and resolved references when digest is provided', () => {
    render(<DailyBrief digest={mockDigest} loading={false} papers={mockPapers} />);

    expect(screen.getByText('Daily Brief')).toBeInTheDocument();
    expect(screen.getByText('5 min read')).toBeInTheDocument();
    expect(screen.getByText('Agentic Workflows are Rising')).toBeInTheDocument();
    expect(screen.getByText('Automated agents are dominating open-source development.')).toBeInTheDocument();
    expect(screen.getByText('Makes AI systems fully autonomous.')).toBeInTheDocument();

    // Check Executive Summary rendering
    expect(screen.getByText('Executive Briefing')).toBeInTheDocument();
    expect(screen.getByText('This is a cohesive executive summary paragraph of the day.')).toBeInTheDocument();

    // Check Resolved References rendering
    expect(screen.getByText('Sources & References')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Reference Paper 1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/paper-1');
  });
});
