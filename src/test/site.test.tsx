import { describe, expect, it, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { bibtex, formatAuthors, splitCitations } from '@/lib/format';
import { __resetLibraryForTests } from '@/lib/library';
import { PaperEntry } from '@/components/PaperEntry';
import { cleanLegacyText, inlineRuns, isFabricated, parseMiniMarkdown } from '@/lib/legacy';
import type { IssuePaper } from '@/types';

describe('format helpers', () => {
  it('formats author lists', () => {
    expect(formatAuthors(['A'])).toBe('A');
    expect(formatAuthors(['A', 'B'])).toBe('A and B');
    expect(formatAuthors(['A', 'B', 'C', 'D'])).toBe('A, B, C et al.');
  });
  it('splits [arXiv-id] citations out of prose', () => {
    expect(splitCitations('See [2611.03826] and [2611.05011].')).toEqual([
      { text: 'See ' },
      { cite: '2611.03826' },
      { text: ' and ' },
      { cite: '2611.05011' },
      { text: '.' },
    ]);
  });
  it('builds BibTeX', () => {
    const b = bibtex({ id: '2611.03650', title: 'Alignment Faking', authors: ['Ada Lovelace', 'Alan Turing'], publishedAt: '2026-11-04' });
    expect(b).toContain('@misc{lovelace2026alignment,');
    expect(b).toContain('author        = {Ada Lovelace and Alan Turing}');
    expect(b).toContain('eprint        = {2611.03650}');
  });
});

const paper: IssuePaper = {
  id: '2611.03650',
  title: 'Alignment Faking Depends on the Value',
  authors: ['Ada Lovelace', 'Alan Turing'],
  abstract: 'First sentence here. Second sentence here. Third sentence that only shows when expanded.',
  categories: ['cs.AI'],
  publishedAt: '2026-11-04',
  sources: ['arxiv', 'huggingface'],
  hf: { upvotes: 42, comments: 1 },
  url: 'https://arxiv.org/abs/2611.03650',
  pdfUrl: 'https://arxiv.org/pdf/2611.03650',
  topics: ['Alignment & Safety'],
  score: 91,
  heuristicScore: 12,
  why: 'Shows alignment faking is value-dependent.',
  tier: 'lead',
};

describe('PaperEntry', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetLibraryForTests();
  });

  it('shows the why-line, a two-sentence preview and expands to the full abstract', () => {
    render(<PaperEntry paper={paper} n={1} edition="general" variant="lead" saved={false} read={false} onToggleSaved={() => {}} onToggleRead={() => {}} />);
    expect(screen.getByText('Shows alignment faking is value-dependent.')).toBeInTheDocument();
    expect(screen.getByText('▲ 42')).toBeInTheDocument();
    expect(screen.queryByText(/Third sentence/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Full abstract' }));
    expect(screen.getByText(/Third sentence/)).toBeInTheDocument();
  });

  it('wires save and read toggles', () => {
    const calls: string[] = [];
    render(
      <PaperEntry paper={paper} n={1} edition="general" variant="lead" saved read={false}
        onToggleSaved={() => calls.push('save')} onToggleRead={() => calls.push('read')} />,
    );
    expect(screen.getByRole('button', { name: '★ Saved' })).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
      fireEvent.click(screen.getByRole('button', { name: '★ Saved' }));
    });
    expect(calls).toEqual(['read', 'save']);
  });
});


describe('old archive helpers', () => {
  it('parses the markdown the old fallback digests used', () => {
    const md = '### Daily Technical Landscape\n\nToday it was **busy**.\n\n1. **Paper A** (ARXIV)\n   - **Core Findings**: x\n2. **Paper B**';
    const blocks = parseMiniMarkdown(md);
    expect(blocks[0]).toEqual({ kind: 'heading', text: 'Daily Technical Landscape' });
    expect(blocks[1]).toEqual({ kind: 'para', text: 'Today it was **busy**.' });
    expect(blocks[2]).toEqual({ kind: 'list', ordered: true, items: ['**Paper A** (ARXIV) — **Core Findings**: x', '**Paper B**'] });
  });
  it('drops the empty emphasis the old fallback left behind', () => {
    expect(parseMiniMarkdown('- **News A** (Blog): text (Tagged: **)')).toEqual([{ kind: 'list', ordered: false, items: ['**News A** (Blog): text'] }]);
  });
  it('splits bold and italic runs', () => {
    expect(inlineRuns('a **b** *c*')).toEqual([{ t: 'a ' }, { t: 'b', b: true }, { t: ' ' }, { t: 'c', i: true }]);
  });
  it('cleans abstracts and flags fabricated newsletter items', () => {
    expect(cleanLegacyText('arXiv:2611.1v1 Announce Type: new Abstract: DeepSeek&#39;s &amp; co')).toBe("DeepSeek's & co");
    expect(isFabricated({ url: 'https://example.com/mock/the-batch' })).toBe(true);
    expect(isFabricated({ url: 'https://importai.substack.com/p/x' })).toBe(false);
  });
});
