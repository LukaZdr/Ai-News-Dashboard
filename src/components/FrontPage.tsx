import type { Issue, IssuePaper } from '@/types';
import { CitedText } from './Citation';
import { scrollToPaper } from '@/lib/scroll';
import { firstSentences, formatAuthors } from '@/lib/format';

interface Props {
  issue: Issue;
  numbers: Map<string, number>;
  papers: Map<string, IssuePaper>;
}

export function FrontPage({ issue, numbers, papers }: Props) {
  const top = issue.papers[0];
  // Without an editor's note the top paper is the lead story, so don't repeat it in the rail.
  const picks = issue.lede
    ? issue.readFirst.filter((r) => papers.has(r.id))
    : issue.papers
        .slice(1, 1 + Math.max(issue.readFirst.length, 3))
        .map((p) => issue.readFirst.find((r) => r.id === p.id) ?? { id: p.id, why: p.why ?? '' });

  return (
    <section className="front" aria-label="Front page">
      <article className="lede">
        {issue.lede ? (
          <>
            <p className="kicker">The editor’s note</p>
            <h1 className="lede-headline">{issue.lede.headline}</h1>
            {issue.lede.dek && <p className="lede-dek">{issue.lede.dek}</p>}
            <div className="lede-body">
              {issue.lede.body.map((para, i) => (
                <p key={i}>
                  <CitedText text={para} numbers={numbers} papers={papers} />
                </p>
              ))}
            </div>
          </>
        ) : (
          // No LLM today: lead with the top-ranked paper itself — real data, no invented prose.
          <>
            <p className="kicker">Top of today’s stack</p>
            <h1 className="lede-headline lede-headline--paper">
              <a href={top.url} target="_blank" rel="noreferrer">
                {top.title}
              </a>
            </h1>
            <p className="lede-dek">{formatAuthors(top.authors, 4)}</p>
            <div className="lede-body lede-body--single">
              <p>{firstSentences(top.abstract, 4)}</p>
            </div>
          </>
        )}
      </article>

      <aside className="read-first" aria-label="Read first">
        <h2 className="rail-heading">{issue.lede ? 'Read first' : 'Also read first'}</h2>
        <ol>
          {picks.map((pick, i) => {
            const p = papers.get(pick.id)!;
            return (
              <li key={pick.id}>
                <span className="rf-numeral" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="rf-title">
                    <button type="button" onClick={() => scrollToPaper(p.id)}>
                      {p.title}
                    </button>
                  </h3>
                  <p className="rf-why">{pick.why}</p>
                  {pick.takeaway && <p className="rf-takeaway">{pick.takeaway}</p>}
                  <p className="rf-links">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      arXiv
                    </a>
                    <a href={p.pdfUrl} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>
    </section>
  );
}
