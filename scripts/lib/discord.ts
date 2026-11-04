import type { EditionConfig, Issue, IssuePaper } from '../../src/types/index.js';
import { truncate } from './text.js';

// Discord embed limits: description 4096, total 6000.
const DESCRIPTION_LIMIT = 3800;

export function buildPayload(edition: EditionConfig, issue: Issue, pageUrl: string, publication: string) {
  const byId = new Map(issue.papers.map((p) => [p.id, p]));
  const picks = issue.readFirst
    .map((r) => ({ pick: r, paper: byId.get(r.id) }))
    .filter((x): x is { pick: typeof x.pick; paper: IssuePaper } => Boolean(x.paper));

  const lines: string[] = [];
  if (issue.lede?.dek) lines.push(`*${issue.lede.dek}*`, '');
  lines.push('**Read first**');
  picks.forEach(({ pick, paper }, i) => {
    lines.push(`**${i + 1}. [${truncate(paper.title, 180)}](${paper.url})**`);
    lines.push(truncate(pick.why, 260));
  });
  const rest = issue.papers.filter((p) => p.tier !== 'radar').length - picks.length;
  lines.push('', `[Open the full issue →](${pageUrl})${rest > 0 ? ` · ${rest} more papers worth your time` : ''}`);

  const date = new Date(`${issue.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  return {
    username: `${publication} · ${edition.name}`,
    embeds: [
      {
        author: { name: `${publication.toUpperCase()} · ${edition.name.toUpperCase()} · NO. ${issue.number}` },
        title: truncate(issue.lede?.headline ?? picks[0]?.paper.title ?? `${edition.name} — ${issue.date}`, 250),
        url: pageUrl,
        description: truncate(lines.join('\n'), DESCRIPTION_LIMIT),
        color: parseInt(edition.accent.light.slice(1), 16),
        footer: {
          text: `${date} · ${issue.stats.screened.toLocaleString('en')} preprints screened · ${issue.stats.published} selected`,
        },
        timestamp: issue.generatedAt,
      },
    ],
  };
}
