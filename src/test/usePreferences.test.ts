import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences } from '../hooks/usePreferences';

describe('usePreferences Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default preferences', () => {
    const { result } = renderHook(() => usePreferences());

    expect(result.current.prefs.darkMode).toBe(true);
    expect(result.current.prefs.bookmarks).toEqual([]);
    expect(result.current.prefs.selectedTopics).toEqual([]);
  });

  it('toggles bookmarks correctly', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.toggleBookmark('item-123', 'paper');
    });

    expect(result.current.isBookmarked('item-123')).toBe(true);
    expect(result.current.prefs.bookmarks).toHaveLength(1);
    expect(result.current.prefs.bookmarks[0]).toMatchObject({
      itemId: 'item-123',
      itemType: 'paper',
    });

    act(() => {
      result.current.toggleBookmark('item-123', 'paper');
    });

    expect(result.current.isBookmarked('item-123')).toBe(false);
    expect(result.current.prefs.bookmarks).toHaveLength(0);
  });

  it('manages topic tags filter state', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.toggleTopic('Agents');
    });
    expect(result.current.prefs.selectedTopics).toContain('Agents');

    act(() => {
      result.current.toggleTopic('Reasoning');
    });
    expect(result.current.prefs.selectedTopics).toContain('Agents');
    expect(result.current.prefs.selectedTopics).toContain('Reasoning');

    act(() => {
      result.current.toggleTopic('Agents');
    });
    expect(result.current.prefs.selectedTopics).not.toContain('Agents');
    expect(result.current.prefs.selectedTopics).toContain('Reasoning');

    act(() => {
      result.current.clearTopics();
    });
    expect(result.current.prefs.selectedTopics).toEqual([]);
  });

  it('toggles dark mode', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.toggleDarkMode();
    });
    expect(result.current.prefs.darkMode).toBe(false);
  });
});
