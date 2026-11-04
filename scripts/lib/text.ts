const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ');
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Plain text from an HTML/XML fragment. Entities are decoded twice because feeds often double-escape. */
export function toPlainText(s: string): string {
  return collapseWhitespace(decodeEntities(stripTags(decodeEntities(s))));
}

/**
 * arXiv RSS summaries are prefixed with "arXiv:2611.03650v1 Announce Type: new Abstract: ".
 */
export function cleanArxivAbstract(summary: string): string {
  return collapseWhitespace(
    toPlainText(summary).replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*Abstract:\s*/i, ''),
  );
}

/** "oai:arXiv.org:2611.03650v2" / "https://arxiv.org/abs/2611.03650v1" → "2611.03650" */
export function normalizeArxivId(raw: string): string {
  const m = raw.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (m) return m[1];
  // Old-style ids such as "cs/0112017"
  const old = raw.match(/([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i);
  return old ? old[1] : raw.trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : cut.length)}…`;
}

/** First n sentences, for short previews. Does not split on "e.g." / "i.e." / "et al.". */
export function firstSentences(s: string, n: number): string {
  const protectedText = s.replace(/\b(e\.g|i\.e|et al|vs|cf|Fig|Eq)\./g, '$1\uE000');
  const parts = protectedText.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [protectedText];
  return parts.slice(0, n).join('').replace(/\uE000/g, '.').trim();
}
