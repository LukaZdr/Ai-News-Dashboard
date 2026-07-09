import { useState, useEffect, useCallback } from 'react';
import type { Bookmark, UserPreferences } from '@/types';

const STORAGE_KEY = 'ai-dashboard-preferences';

const defaultPrefs: UserPreferences = {
  bookmarks: [],
  readItems: [],
  selectedTopics: [],
  darkMode: true,
};

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultPrefs, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return defaultPrefs;
}

function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences);

  useEffect(() => { savePreferences(prefs); }, [prefs]);

  const toggleBookmark = useCallback((itemId: string, itemType: Bookmark['itemType']) => {
    setPrefs((prev) => {
      const exists = prev.bookmarks.find((b) => b.itemId === itemId);
      return {
        ...prev,
        bookmarks: exists
          ? prev.bookmarks.filter((b) => b.itemId !== itemId)
          : [...prev.bookmarks, { itemId, itemType, savedAt: new Date().toISOString() }],
      };
    });
  }, []);

  const markAsRead = useCallback((itemId: string) => {
    setPrefs((prev) => {
      if (prev.readItems.find((r) => r.itemId === itemId)) return prev;
      return {
        ...prev,
        readItems: [...prev.readItems, { itemId, readAt: new Date().toISOString() }],
      };
    });
  }, []);

  const isBookmarked = useCallback((itemId: string) => {
    return prefs.bookmarks.some((b) => b.itemId === itemId);
  }, [prefs.bookmarks]);

  const isRead = useCallback((itemId: string) => {
    return prefs.readItems.some((r) => r.itemId === itemId);
  }, [prefs.readItems]);

  const toggleTopic = useCallback((topic: string) => {
    setPrefs((prev) => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topic)
        ? prev.selectedTopics.filter((t) => t !== topic)
        : [...prev.selectedTopics, topic],
    }));
  }, []);

  const clearTopics = useCallback(() => {
    setPrefs((prev) => ({ ...prev, selectedTopics: [] }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setPrefs((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  }, []);

  return {
    prefs, toggleBookmark, markAsRead, isBookmarked, isRead,
    toggleTopic, clearTopics, toggleDarkMode,
  };
}
