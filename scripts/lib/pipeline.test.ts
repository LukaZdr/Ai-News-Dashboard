import { describe, expect, it } from 'vitest';
import { cleanArxivAbstract, decodeEntities, normalizeArxivId, toPlainText } from './text.js';
import { blendScore, compileKeyword, compileProfile, heuristicScore, isEligible } from './scoring.js';
import { extractJson } from './llm.js';
import { buildSearchQuery, mergeSources, parseArxivFeed, parseArxivSearch } from './sources.js';
import { fillReadFirst } from './editor.js';
import { buildPayload } from './discord.js';
import type { EditionConfig, Issue, IssuePaper } from '../../src/types/index.js';

const FEED = `<?xml version="1.0"?><feed>
<entry>
  <id>oai:arXiv.org:2611.03650v1</id>
  <title>Alignment Faking Depends on the Value</title>
  <link href="https://arxiv.org/abs/2611.03650"/>
  <summary>arXiv:2611.03650v1 Announce Type: new
Abstract: Language models &amp; values. Code at https://x.y.</summary>
  <category term="cs.AI"/><category term="cs.CL"/>
  <published>2026-11-04T00:00:00-05:00</published>
  <arxiv:announce_type>new</arxiv:announce_type>
  <dc:creator>Ada Lovelace (Analytical Engines, London), Alan Turing and Grace Hopper</dc:creator>
</entry>
<entry>
  <id>oai:arXiv.org:2401.00001v3</id>
  <title>An Old Paper, Revised</title>
  <summary>arXiv:2401.00001v3 Announce Type: replace Abstract: old</summary>
  <category term="cs.LG"/>
  <arxiv:announce_type>replace</arxiv:announce_type>
</entry>
<entry>
  <id>oai:arXiv.org:2611.04000v1</id>
  <title>Cross-listed thing</title>
  <summary>arXiv:2611.04000v1 Announce Type: cross Abstract: x</summary>
  <category term="eess.IV"/>
  <arxiv:announce_type>cross</arxiv:announce_type>
</entry>
</feed>`;

describe('text cleaning', () => {
  it('strips the arXiv RSS prefix and decodes entities', () => {
    expect(cleanArxivAbstract('arXiv:2611.03650v1 Announce Type: new \nAbstract: A &amp; B')).toBe('A & B');
  });
  it('decodes numeric and double-escaped entities', () => {
    expect(decodeEntities('DeepSeek&#39;s')).toBe("DeepSeek's");
    expect(toPlainText('&amp;quot;hi&amp;quot; <b>there</b>')).toBe('"hi" there');
  });
  it('normalises arXiv ids', () => {
    expect(normalizeArxivId('oai:arXiv.org:2611.03650v2')).toBe('2611.03650');
    expect(normalizeArxivId('https://arxiv.org/abs/2611.03650v1')).toBe('2611.03650');
  });
});

describe('parseArxivFeed', () => {
  const parsed = parseArxivFeed(FEED);
  it('drops replacements (revisions of old papers)', () => {
    expect(parsed.totalEntries).toBe(3);
    expect(parsed.replacementsDropped).toBe(1);
    expect(parsed.papers.map((p) => p.id)).toEqual(['2611.03650', '2611.04000']);
  });
  it('extracts authors, categories, announce type and date', () => {
    const [p, cross] = parsed.papers;
    expect(p.authors).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
    expect(p.categories).toEqual(['cs.AI', 'cs.CL']);
    expect(p.abstract).toBe('Language models & values. Code at https://x.y.');
    expect(cross.announceType).toBe('cross');
    expect(parsed.announcedOn).toBe('2026-11-04');
  });
});

describe('keyword matching', () => {
  it('respects word boundaries (the old tagger matched "rl" inside "world")', () => {
    expect(compileKeyword('rl').test('a world model')).toBe(false);
    expect(compileKeyword('rl').test('offline RL works')).toBe(true);
    expect(compileKeyword('rag').test('on average')).toBe(false);
  });
  it('supports prefix keywords and flexible phrases', () => {
    expect(compileKeyword('radiolog*').test('Radiologists agree')).toBe(true);
    expect(compileKeyword('chain of thought').test('chain-of-thought prompting')).toBe(true);
    expect(compileKeyword('tutor').test('a tutorial on X')).toBe(false);
  });
});

const edition = {
  arxivCategories: ['cs.CY', 'cs.CL'],
  requireTopicMatch: true,
  minHeuristicScore: 3,
  topics: [{ name: 'Tutoring', weight: 2, keywords: ['tutoring', 'tutor'] }],
  exclude: ['distill*'],
} satisfies Pick<EditionConfig, 'arxivCategories' | 'topics' | 'exclude' | 'requireTopicMatch' | 'minHeuristicScore'>;

describe('heuristic scoring and eligibility', () => {
  const profile = compileProfile(edition);
  it('weights title hits above abstract hits', () => {
    const title = heuristicScore({ title: 'LLM tutoring', abstract: 'x' }, profile);
    const abs = heuristicScore({ title: 'x', abstract: 'about tutoring' }, profile);
    expect(title.score).toBe(6);
    expect(abs.score).toBe(2);
    expect(title.topics).toEqual(['Tutoring']);
  });
  it('penalises exclude phrases', () => {
    const r = heuristicScore({ title: 'Tutor distillation', abstract: '' }, profile);
    expect(r.excluded).toBe(1);
    expect(r.score).toBeLessThan(6);
  });
  it('boosts Hugging Face upvotes', () => {
    const r = heuristicScore({ title: 'x', abstract: 'y', hf: { upvotes: 63, comments: 0 } }, profile, 1);
    expect(r.score).toBe(21);
  });
  it('focused editions: upvotes alone cannot make a paper eligible', () => {
    const paper = { categories: ['cs.CL'], sources: ['arxiv' as const] };
    const offTopic = heuristicScore({ title: 'Video diffusion', abstract: '', hf: { upvotes: 500, comments: 0 } }, profile, 1);
    expect(isEligible(paper, edition, offTopic)).toBe(false);
    const onTopic = heuristicScore({ title: 'LLM tutoring', abstract: '' }, profile);
    expect(isEligible(paper, edition, onTopic)).toBe(true);
    expect(isEligible({ ...paper, categories: ['cs.RO'] }, edition, onTopic)).toBe(false);
    // Keyword-search hits skip the category filter.
    expect(isEligible({ categories: ['cs.RO'], sources: ['search'] }, edition, onTopic)).toBe(true);
  });
  it('gate topics: method words alone cannot qualify an off-domain paper', () => {
    const medical = {
      ...edition,
      minGateScore: 2,
      topics: [
        { name: 'Multimodal', weight: 2.2, keywords: ['multimodal'] },
        { name: 'Clinical', weight: 1.3, gate: true, keywords: ['patient*', 'clinical'] },
      ],
      exclude: [],
    };
    const prof = compileProfile(medical);
    const paper = { categories: ['cs.CL'], sources: ['arxiv' as const] };
    const generic = heuristicScore({ title: 'A multimodal LLM', abstract: 'multimodal everything' }, prof);
    expect(generic.topicScore).toBeGreaterThan(3);
    expect(generic.gateScore).toBe(0);
    expect(isEligible(paper, medical, generic)).toBe(false);
    const passing = heuristicScore({ title: 'A multimodal LLM', abstract: 'helps patients' }, prof);
    expect(isEligible(paper, medical, passing)).toBe(false); // one weak gate hit (1.3) < minGateScore 2
    const clinical = heuristicScore({ title: 'Multimodal fusion for patient outcomes', abstract: 'clinical data' }, prof);
    expect(isEligible(paper, medical, clinical)).toBe(true);
  });
  it('blends LLM and heuristic scores onto 0–100', () => {
    expect(blendScore(10, 10)).toBe(100);
    expect(blendScore(0, 10, 10)).toBe(75);
    expect(blendScore(10, 10, 8)).toBe(85);
  });
});

describe('arXiv keyword search', () => {
  const API = `<feed><opensearch:totalResults>1</opensearch:totalResults>
<entry>
  <id>http://arxiv.org/abs/2611.00802v2</id>
  <published>2026-10-31T10:00:00Z</published>
  <title>EduExplain: A Benchmark
   for Explanation Retrieval</title>
  <summary>We introduce a benchmark &amp; dataset.</summary>
  <author><name>Ada Lovelace</name></author><author><name>Alan Turing</name></author>
  <arxiv:primary_category term="cs.IR"/><category term="cs.IR"/><category term="cs.CY"/>
</entry></feed>`;
  it('parses API entries as search hits', () => {
    const [p] = parseArxivSearch(API);
    expect(p).toMatchObject({
      id: '2611.00802',
      title: 'EduExplain: A Benchmark for Explanation Retrieval',
      authors: ['Ada Lovelace', 'Alan Turing'],
      abstract: 'We introduce a benchmark & dataset.',
      categories: ['cs.IR', 'cs.CY'],
      sources: ['search'],
    });
  });
  it('builds a title/abstract phrase query with a submission-date window', () => {
    const q = buildSearchQuery(['knowledge tracing', 'AI "tutor"'], 5, new Date('2026-11-04T06:30:00Z'));
    expect(q).toBe(
      '(ti:"knowledge tracing" OR abs:"knowledge tracing" OR ti:"AI tutor" OR abs:"AI tutor") AND submittedDate:[202610300000 TO 202611042359]',
    );
  });
});

describe('mergeSources', () => {
  it('attaches HF signals to arXiv papers and appends HF-only papers', () => {
    const base = { title: 't', authors: [], abstract: '', categories: [], publishedAt: '' };
    const merged = mergeSources(
      [{ ...base, id: '1', sources: ['arxiv'] }],
      [
        { ...base, id: '1', sources: ['huggingface'], hf: { upvotes: 5, comments: 0 } },
        { ...base, id: '2', sources: ['huggingface'], hf: { upvotes: 1, comments: 0 } },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].sources).toEqual(['arxiv', 'huggingface']);
    expect(merged[0].hf?.upvotes).toBe(5);
  });
});

describe('extractJson', () => {
  it('handles fences, think blocks and trailing prose', () => {
    expect(extractJson('<think>{"no": 1}</think>Sure!\n```json\n[{"id":"1","why":"a ] b"}]\n```\nDone')).toEqual([
      { id: '1', why: 'a ] b' },
    ]);
  });
  it('throws on truncated output instead of returning garbage', () => {
    expect(() => extractJson('{"headline": "x", "body": ["a')).toThrow();
  });
});

const paper = (id: string, extra: Partial<IssuePaper> = {}): IssuePaper => ({
  id,
  title: `Paper ${id}`,
  authors: ['A'],
  abstract: 'First sentence. Second sentence.',
  categories: [],
  publishedAt: '2026-11-04',
  sources: ['arxiv'],
  url: `https://arxiv.org/abs/${id}`,
  pdfUrl: `https://arxiv.org/pdf/${id}`,
  topics: ['Tutoring'],
  score: 90,
  heuristicScore: 5,
  tier: 'lead',
  ...extra,
});

describe('fillReadFirst', () => {
  it('keeps editor picks and tops up from the ranking without duplicates', () => {
    const papers = [paper('1'), paper('2'), paper('3')];
    const picks = fillReadFirst([{ id: '2', why: 'editor' }], papers, 3);
    expect(picks.map((p) => p.id)).toEqual(['2', '1', '3']);
    expect(picks[1].takeaway).toBe('First sentence.');
  });
});

describe('Discord payload', () => {
  const ed = { name: 'Medical AI', accent: { light: '#0d6b5e', dark: '#fff' } } as EditionConfig;
  const issue: Issue = {
    edition: 'medical',
    date: '2026-11-04',
    number: 7,
    generatedAt: '2026-11-04T06:30:00Z',
    editor: { mode: 'llm', model: 'm' },
    lede: { headline: 'Evaluation under scrutiny', dek: 'A dek.', body: ['x'] },
    readFirst: [{ id: '1', why: 'Because.' }],
    papers: [paper('1'), paper('2', { tier: 'notable' }), paper('3', { tier: 'radar' })],
    dispatches: [],
    topics: [],
    stats: { screened: 1036, matched: 65, alreadyFeatured: 0, published: 3 },
  };
  it('links to the edition page and the read-first papers', () => {
    const payload = buildPayload(ed, issue, 'https://x.github.io/repo/#/medical', 'The Preprint');
    const embed = payload.embeds[0];
    expect(embed.title).toBe('Evaluation under scrutiny');
    expect(embed.url).toBe('https://x.github.io/repo/#/medical');
    expect(embed.color).toBe(0x0d6b5e);
    expect(embed.description).toContain('[Paper 1](https://arxiv.org/abs/1)');
    expect(embed.description).toContain('1 more papers worth your time');
    expect(embed.footer.text).toContain('1,036 preprints screened');
    expect(JSON.stringify(payload).length).toBeLessThan(6000);
  });
});
