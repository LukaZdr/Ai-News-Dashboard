import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT_DIR, 'data');
export const CONFIG_DIR = join(ROOT_DIR, 'config');

export const USER_AGENT = 'the-preprint/2.0 (+https://github.com/LukaZdr/Ai-News-Dashboard)';

export function shortHash(input: string): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export function readJson<T>(path: string, fallback?: T): T {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing file: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 3, timeoutMs = 60_000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': USER_AGENT, ...init.headers },
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
      // Client errors other than rate limiting won't fix themselves.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`Failed to fetch ${url}: ${(lastError as Error)?.message ?? lastError}`);
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
