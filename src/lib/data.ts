import { useEffect, useRef, useState } from 'react';
import type { Issue, IssueIndexEntry, Manifest } from '@/types';

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

async function getJson<T>(path: string, bust?: string): Promise<T> {
  const url = `${BASE}${path}${bust ? `?v=${encodeURIComponent(bust)}` : ''}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { cache: bust ? 'default' : 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${path}`);
        return r.json();
      }),
    );
    // Don't cache failures — allow a retry.
    cache.get(url)!.catch(() => cache.delete(url));
  }
  return cache.get(url) as Promise<T>;
}

export const loadManifest = () => getJson<Manifest>('editions.json');

export const loadIndex = (slug: string, bust: string) => getJson<IssueIndexEntry[]>(`editions/${slug}/index.json`, bust);

export const loadIssue = (slug: string, date: string, bust: string) =>
  getJson<Issue>(`editions/${slug}/issues/${date}.json`, bust);

export type Async<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };

/** Runs `fn` whenever `key` changes; `null` fn means "nothing to load yet". */
export function useAsync<T>(fn: (() => Promise<T>) | null, key: string): Async<T> {
  const [state, setState] = useState<Async<T>>({ status: 'loading' });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const run = fnRef.current;
    if (!run) return;
    let alive = true;
    setState({ status: 'loading' });
    run().then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: Error) => alive && setState({ status: 'error', error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}
