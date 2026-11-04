export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function formatAuthors(authors: string[], max = 3): string {
  if (authors.length === 0) return '';
  if (authors.length <= max) {
    return authors.length === 1 ? authors[0] : `${authors.slice(0, -1).join(', ')} and ${authors.at(-1)}`;
  }
  return `${authors.slice(0, max).join(', ')} et al.`;
}

/** Split text on [arXiv-id] citations. */
export function splitCitations(text: string): Array<{ text: string } | { cite: string }> {
  const out: Array<{ text: string } | { cite: string }> = [];
  const re = /\[(\d{4}\.\d{4,5})\]/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ cite: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function firstSentences(s: string, n: number): string {
  const guarded = s.replace(/\b(e\.g|i\.e|et al|vs|cf|Fig|Eq)\./g, '$1\uE000');
  const parts = guarded.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [guarded];
  return parts.slice(0, n).join('').replace(/\uE000/g, '.').trim();
}

export function bibtex(p: { id: string; title: string; authors: string[]; publishedAt: string }): string {
  const year = (p.publishedAt || '').slice(0, 4) || new Date().getFullYear().toString();
  const firstAuthor = (p.authors[0] ?? 'anon').split(/\s+/).at(-1)!.toLowerCase().replace(/[^a-z]/g, '');
  const firstWord = p.title.toLowerCase().match(/[a-z]{4,}/)?.[0] ?? 'paper';
  return [
    `@misc{${firstAuthor}${year}${firstWord},`,
    `  title         = {${p.title}},`,
    `  author        = {${p.authors.join(' and ')}},`,
    `  year          = {${year}},`,
    `  eprint        = {${p.id}},`,
    `  archivePrefix = {arXiv},`,
    `  url           = {https://arxiv.org/abs/${p.id}}`,
    `}`,
  ].join('\n');
}
