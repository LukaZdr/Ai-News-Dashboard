import type { LegacyDay, LegacyDigest, LegacyNews, LegacyNewsletter, LegacyPaper, LegacyRepo, LegacyVideo } from '@/types/legacy';

const BASE = `${import.meta.env.BASE_URL}data/legacy/archive/`;

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(BASE + path);
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadLegacyIndex(): Promise<string[]> {
  const r = await fetch(`${BASE}index.json`);
  if (!r.ok) throw new Error(`${r.status} legacy index`);
  return ((await r.json()) as string[]).sort().reverse();
}

export async function loadLegacyDay(date: string): Promise<LegacyDay> {
  const [digest, papers, news, newsletters, videos, repos] = await Promise.all([
    get<LegacyDigest | null>(`${date}/digest.json`, null),
    get<LegacyPaper[]>(`${date}/papers.json`, []),
    get<LegacyNews[]>(`${date}/news.json`, []),
    get<LegacyNewsletter[]>(`${date}/newsletters.json`, []),
    get<LegacyVideo[]>(`${date}/videos.json`, []),
    get<LegacyRepo[]>(`${date}/github.json`, []),
  ]);
  if (!digest && papers.length + news.length === 0) throw new Error(`No archived data for ${date}`);
  return { digest, papers, news, newsletters, videos, repos };
}

/** The old pipeline invented newsletter issues when a feed failed; they all link here. */
export const isFabricated = (item: { url: string }) => item.url.includes('example.com/mock');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function cleanLegacyText(s: string): string {
  return (s || '')
    .replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*Abstract:\s*/i, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MdBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

/**
 * Minimal Markdown → blocks, enough for the old digests (### headings,
 * paragraphs, "- " and "1. " lists). Inline **bold** / *italic* is handled by renderInline.
 */
export function parseMiniMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  // The old fallback wrote "(Tagged: *${tags}*)" even with no tags, leaving "(Tagged: **)".
  const tidy = src
    .replace(/\r/g, '')
    .replace(/(^|[\s(:])\*\*(?=[\s).,;]|$)/gm, '$1')
    .replace(/\s*\((?:Tagged|Key Focus Areas):?\s*\)/g, '');
  for (const chunk of tidy.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (lines.length === 0) continue;
    let list: Extract<MdBlock, { kind: 'list' }> | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
      para = [];
    };
    for (const raw of lines) {
      const line = raw.trim();
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const ordered = line.match(/^\d+[.)]\s+(.*)$/);
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      if (heading) {
        flushPara();
        list = null;
        blocks.push({ kind: 'heading', text: heading[1] });
      } else if (ordered || bullet) {
        flushPara();
        const isOrdered = Boolean(ordered);
        // Indented bullets under a numbered item are folded into that item.
        if (list && raw.startsWith(' ') && list.items.length) {
          list.items[list.items.length - 1] += ` — ${(ordered ?? bullet)![1]}`;
          continue;
        }
        if (!list || list.ordered !== isOrdered) {
          list = { kind: 'list', ordered: isOrdered, items: [] };
          blocks.push(list);
        }
        list.items.push((ordered ?? bullet)![1]);
      } else {
        list = null;
        para.push(line);
      }
    }
    flushPara();
  }
  return blocks;
}

/** Split inline markdown into plain / bold / italic runs. */
export function inlineRuns(text: string): Array<{ t: string; b?: boolean; i?: boolean }> {
  const out: Array<{ t: string; b?: boolean; i?: boolean }> = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ t: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: m[1], b: true } : { t: m[2], i: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
