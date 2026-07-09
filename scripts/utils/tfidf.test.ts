import { describe, it, expect } from 'vitest';
import { extractTerms } from './index.js';
import {
  trackCasing,
  getBestCasing,
  updateHistoricalDF,
  computeTFIDF,
  type HistoricalDF
} from './tfidf.js';

describe('TF-IDF Utilities', () => {
  describe('extractTerms', () => {
    it('tokenizes text, filters stopwords, and extracts unigrams and bigrams', () => {
      const text = 'DeepSeek-V3 is an open source LLM model with reinforcement learning.';
      const terms = extractTerms(text);

      // Unigrams (filtered stopwords/domain keywords)
      expect(terms).toContain('deepseek-v3');
      expect(terms).toContain('reinforcement');
      expect(terms).toContain('learning');

      // Bigrams (filtered out stopwords and domain keywords)
      expect(terms).toContain('reinforcement learning');

      // Stopwords and generic terms should be filtered
      expect(terms).not.toContain('is');
      expect(terms).not.toContain('an');
      expect(terms).not.toContain('open'); // stopword/generic
      expect(terms).not.toContain('source'); // stopword/generic
      expect(terms).not.toContain('model'); // domain keyword
    });
  });

  describe('Casing Tracking', () => {
    it('tracks casing frequencies and returns the most frequent capitalization', () => {
      const casingMap: Record<string, Record<string, number>> = {};
      
      trackCasing('We love Claude Sonnet.', ['claude sonnet'], casingMap);
      trackCasing('Yes, claude sonnet is cool.', ['claude sonnet'], casingMap);
      trackCasing('Using Claude Sonnet again.', ['claude sonnet'], casingMap);

      expect(casingMap['claude sonnet']).toBeDefined();
      expect(casingMap['claude sonnet']['Claude Sonnet']).toBe(2);
      expect(casingMap['claude sonnet']['claude sonnet']).toBe(1);

      const best = getBestCasing('claude sonnet', casingMap);
      expect(best).toBe('Claude Sonnet');
    });

    it('returns title case fallback if no casing is tracked', () => {
      const casingMap = {};
      const best = getBestCasing('test term', casingMap);
      expect(best).toBe('Test Term');
    });
  });

  describe('Historical DF Updates', () => {
    it('updates total documents and term frequencies', () => {
      const df: HistoricalDF = {
        totalDocuments: 10,
        frequencies: {
          'claude': 2,
          'gpt': 5,
        },
      };

      const todayDocs = [
        ['claude', 'sonnet'],
        ['gpt', 'o1'],
      ];

      updateHistoricalDF(todayDocs, df);

      expect(df.totalDocuments).toBe(12);
      expect(df.frequencies['claude']).toBe(3);
      expect(df.frequencies['gpt']).toBe(6);
      expect(df.frequencies['sonnet']).toBe(1);
      expect(df.frequencies['o1']).toBe(1);
    });
  });

  describe('computeTFIDF', () => {
    it('computes and ranks terms based on TF-IDF sum score', () => {
      const df: HistoricalDF = {
        totalDocuments: 100,
        frequencies: {
          // 'common' is extremely frequent, so low IDF
          'common': 90,
          // 'rare' is very rare, so high IDF
          'rare': 2,
        },
      };

      const todayDocs = [
        ['common', 'rare', 'special'],
        ['common', 'special'],
      ];

      // Update DF with today's docs so we have a consistent state
      updateHistoricalDF(todayDocs, df);

      const results = computeTFIDF(todayDocs, df);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].term).toBe('special'); // 'special' or 'rare' should be at the top, not 'common'
      
      const commonResult = results.find(r => r.term === 'common');
      const rareResult = results.find(r => r.term === 'rare');
      const specialResult = results.find(r => r.term === 'special');

      expect(rareResult!.score).toBeGreaterThan(commonResult!.score);
      expect(specialResult!.score).toBeGreaterThan(commonResult!.score);
    });
  });
});
