import { useCallback, useSyncExternalStore } from 'react';
import type { IssuePaper } from '@/types';

/**
 * The reader's personal state — saved papers and read marks — lives in
 * localStorage, so the site stays a static page with no backend.
 * Saved papers are stored as snapshots so the reading list survives
 * after the issue that contained them rolls off.
 */

export interface SavedPaper {
  id: string;
  title: string;
  authors: string[];
  url: string;
  pdfUrl: string;
  abstract: string;
  publishedAt: string;
  edition: string;
  why?: string;
  savedAt: string;
}

export interface LibraryState {
  saved: Record<string, SavedPaper>;
  read: Record<string, string>;
}

const KEY = 'preprint.library.v1';
const EMPTY: LibraryState = { saved: {}, read: {} };
const listeners = new Set<() => void>();
let snapshot: LibraryState = load();

function load(): LibraryState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LibraryState>;
    return { saved: parsed.saved ?? {}, read: parsed.read ?? {} };
  } catch {
    return EMPTY;
  }
}

function commit(next: LibraryState) {
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode / storage full: state still works for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = load();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLibrary() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);

  const toggleSaved = useCallback((paper: IssuePaper, edition: string) => {
    const saved = { ...snapshot.saved };
    if (saved[paper.id]) delete saved[paper.id];
    else
      saved[paper.id] = {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        url: paper.url,
        pdfUrl: paper.pdfUrl,
        abstract: paper.abstract,
        publishedAt: paper.publishedAt,
        edition,
        why: paper.why,
        savedAt: new Date().toISOString(),
      };
    commit({ ...snapshot, saved });
  }, []);

  const removeSaved = useCallback((id: string) => {
    const saved = { ...snapshot.saved };
    delete saved[id];
    commit({ ...snapshot, saved });
  }, []);

  const toggleRead = useCallback((id: string) => {
    const read = { ...snapshot.read };
    if (read[id]) delete read[id];
    else read[id] = new Date().toISOString();
    commit({ ...snapshot, read });
  }, []);

  return {
    state,
    isSaved: (id: string) => Boolean(state.saved[id]),
    isRead: (id: string) => Boolean(state.read[id]),
    toggleSaved,
    removeSaved,
    toggleRead,
  };
}

/** Test hook. */
export function __resetLibraryForTests() {
  snapshot = load();
}
