import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Manifest } from '@/types';
import type { LegacyDay } from '@/types/legacy';
import { Masthead } from '@/components/Masthead';
import { useAsync } from '@/lib/data';
import { cleanLegacyText, inlineRuns, isFabricated, loadLegacyDay, loadLegacyIndex, parseMiniMarkdown } from '@/lib/legacy';
import { formatAuthors, longDate, shortDate } from '@/lib/format';

const NOTE =
  'Daily snapshots from the earlier AI Newspaper pipeline, kept as they were collected. Papers in these issues were not ranked, and some summaries were written from incomplete data.';

/** #/archive and #/archive/:date */
export function LegacyArchive({ manifest }: { manifest: Manifest }) {
  const { date } = useParams();
  const index = useAsync(loadLegacyIndex, 'legacy-index');
  const dates = index.status === 'ready' ? index.data : [];
  const pos = date ? dates.indexOf(date) : -1;
  const newer = pos > 0 ? dates[pos - 1] : null;
  const older = pos >= 0 && pos < dates.length - 1 ? dates[pos + 1] : null;

  return (
    <div className="edition edition--legacy">
      <Masthead
        manifest={manifest}
        tagline="The old archive — before The Preprint."
        strapLeft={
          <>
            <Link className="strap-button" to="/archive">
              Old archive
            </Link>
            {date && (
              <>
                <span className="strap-sep">·</span>
                <span>{longDate(date)}</span>
              </>
            )}
          </>
        }
        strapRight={
          date && (
            <>
              {older && (
                <Link className="strap-button" to={`/archive/${older}`}>
                  ← Earlier
                </Link>
              )}
              {newer && (
                <Link className="strap-button" to={`/archive/${newer}`}>
                  Later →
                </Link>
              )}
            </>
          )
        }
      />
      <main>
        {index.status === 'error' ? (
          <div className="notice">
            <h2>The old archive is missing</h2>
            <p>{index.error}</p>
          </div>
        ) : date ? (
          <LegacyDayView date={date} />
        ) : (
          <LegacyIndex dates={dates} loading={index.status === 'loading'} />
        )}
      </main>
    </div>
  );
}

function LegacyIndex({ dates, loading }: { dates: string[]; loading: boolean }) {
  if (loading) return <p className="loading">Opening the stacks…</p>;
  const byMonth = new Map<string, string[]>();
  for (const d of dates) {
    const key = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    byMonth.set(key, [...(byMonth.get(key) ?? []), d]);
  }
  return (
    <div className="legacy">
      <p className="legacy-note">{NOTE}</p>
      <p className="papers-sub">{dates.length} days archived</p>
      {[...byMonth].map(([month, days]) => (
        <section key={month} className="legacy-month">
          <h3 className="tier-heading">{month}</h3>
          <ul className="legacy-days">
            {days.map((d) => (
              <li key={d}>
                <Link to={`/archive/${d}`}>
                  <span className="legacy-dow">
                    {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
                  </span>
                  <span className="legacy-dom">{Number(d.slice(8))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineRuns(text).map((r, i) =>
        r.b ? <strong key={i}>{r.t}</strong> : r.i ? <em key={i}>{r.t}</em> : <Fragment key={i}>{r.t}</Fragment>,
      )}
    </>
  );
}

function LegacyDayView({ date }: { date: string }) {
  const day = useAsync(() => loadLegacyDay(date), `legacy-${date}`);
  if (day.status === 'loading') return <p className="loading">Opening the stacks…</p>;
  if (day.status === 'error')
    return (
      <div className="notice">
        <h2>Nothing archived for this day</h2>
        <p>
          {day.error}. <Link to="/archive">Back to the old archive</Link>.
        </p>
      </div>
    );
  return <LegacyDayBody day={day.data} />;
}

function LegacyDayBody({ day }: { day: LegacyDay }) {
  const { digest } = day;
  const newsletters = day.newsletters.filter((n) => !isFabricated(n));
  const hidden = day.newsletters.length - newsletters.length;

  return (
    <div className="legacy">
      <p className="legacy-note">{NOTE}</p>

      {digest && (
        <section className="legacy-digest">
          <p className="kicker">Daily digest · {digest.model}</p>
          <div className="legacy-summary">
            {parseMiniMarkdown(digest.summary ?? '').map((b, i) =>
              b.kind === 'heading' ? (
                <h3 key={i} className="tier-heading">
                  {b.text}
                </h3>
              ) : b.kind === 'para' ? (
                <p key={i}>
                  <Inline text={b.text} />
                </p>
              ) : b.ordered ? (
                <ol key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>
              ) : (
                <ul key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>
              ),
            )}
          </div>
          {digest.topDevelopments.length > 0 && (
            <>
              <h3 className="tier-heading">Top developments</h3>
              <ol className="legacy-devs">
                {digest.topDevelopments.map((d) => (
                  <li key={d.rank}>
                    <h4>{d.title}</h4>
                    <p>{d.summary}</p>
                    {d.whyItMatters && <p className="entry-why">{d.whyItMatters}</p>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      <div className="columns">
        <div className="papers">
          <h3 className="tier-heading">Papers · {day.papers.length}</h3>
          {day.papers.length === 0 && <p className="legacy-empty">No papers were collected this day.</p>}
          {day.papers.map((p) => (
            <article key={p.id} className="entry entry--notable">
              <p className="entry-meta">
                <span>{p.source}</span>
                <span>{shortDate(p.date)}</span>
              </p>
              <h4 className="entry-title">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {cleanLegacyText(p.title)}
                </a>
              </h4>
              <p className="entry-authors">{formatAuthors(p.authors)}</p>
              <p className="entry-abstract">{cleanLegacyText(p.abstract)}</p>
            </article>
          ))}
        </div>

        <aside className="rail">
          <LinkList
            title="Newsletters"
            note={hidden > 0 ? `${hidden} placeholder ${hidden === 1 ? 'item' : 'items'} the old pipeline generated for unreachable feeds ${hidden === 1 ? 'is' : 'are'} hidden.` : undefined}
            items={newsletters.map((n) => ({ id: n.id, href: n.url, label: cleanLegacyText(n.title), meta: n.source }))}
          />
          <LinkList title="Company news" items={day.news.map((n) => ({ id: n.id, href: n.url, label: cleanLegacyText(n.title), meta: n.source }))} />
          <LinkList title="Videos" items={day.videos.map((v) => ({ id: v.id, href: v.url, label: cleanLegacyText(v.title), meta: v.channel }))} />
          <LinkList
            title="Repositories"
            items={day.repos.map((r) => ({
              id: r.id,
              href: r.url,
              label: r.fullName,
              meta: `★ ${r.stars.toLocaleString('en')}${r.latestRelease ? ` · ${r.latestRelease.tag}` : ''}`,
            }))}
          />
        </aside>
      </div>
    </div>
  );
}

function LinkList({ title, note, items }: { title: string; note?: string; items: Array<{ id: string; href: string; label: string; meta: string }> }) {
  if (items.length === 0 && !note) return null;
  return (
    <section className="rail-block">
      <h2 className="rail-heading">{title}</h2>
      {note && <p className="rail-sub">{note}</p>}
      <ul className="dispatches">
        {items.map((i) => (
          <li key={i.id}>
            <p className="dispatch-source">{i.meta}</p>
            <a className="dispatch-title" href={i.href} target="_blank" rel="noreferrer">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
