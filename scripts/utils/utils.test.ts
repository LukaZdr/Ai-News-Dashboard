import { describe, it, expect } from 'vitest';
import { generateId, deduplicateByField, autoTag, isWithinTimeframe } from './index.js';

describe('Script Utilities', () => {
  describe('generateId', () => {
    it('generates consistent 12-char hex hashes', () => {
      const id1 = generateId('test-input');
      const id2 = generateId('test-input');
      const id3 = generateId('other-input');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1.length).toBe(12);
      expect(/^[0-9a-f]{12}$/.test(id1)).toBe(true);
    });
  });

  describe('deduplicateByField', () => {
    it('deduplicates object arrays by specified field name', () => {
      const data = [
        { id: '1', title: 'First' },
        { id: '2', title: 'Second' },
        { id: '1', title: 'Duplicate First' },
      ];

      const deduped = deduplicateByField(data, 'id');
      expect(deduped).toHaveLength(2);
      expect(deduped[0]).toEqual({ id: '1', title: 'First' });
      expect(deduped[1]).toEqual({ id: '2', title: 'Second' });
    });
  });

  describe('autoTag', () => {
    it('identifies keywords and returns matching tags', () => {
      const text = 'Exploring multi-agent systems and reinforcement learning with PPO in o1 reasoning models.';
      const tags = autoTag(text);

      expect(tags).toContain('Agents');
      expect(tags).toContain('Reasoning');
      expect(tags).toContain('RL');
    });

    it('returns empty array when no keywords match', () => {
      const text = 'some generic text with nothing interesting';
      expect(autoTag(text)).toEqual([]);
    });
  });

  describe('isWithinTimeframe', () => {
    it('returns true for dates within specified hours limit', () => {
      const recent = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
      expect(isWithinTimeframe(recent, 10)).toBe(true);
    });

    it('returns false for dates outside specified hours limit', () => {
      const old = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
      expect(isWithinTimeframe(old, 10)).toBe(false);
    });
  });
});
