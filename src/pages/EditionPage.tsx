import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import type { Issue, IssueIndexEntry, IssuePaper, Manifest } from '@/types';
import { loadIndex, loadIssue, useAsync } from '@/lib/data';
import { longDate } from '@/lib/format';
import { useLibrary } from '@/lib/library';
import { Masthead } from '@/components/Masthead';
import { FrontPage } from '@/components/FrontPage';
import { PaperEntry, RadarList } from '@/components/PaperEntry';
import { Archive, Dispatches, TopicIndex } from '@/components/Sidebar';
import { Colophon } from '@/components/Colophon';

export function EditionPage({ manifest }: { manifest: Manifest }) {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const edition = manifest.editions.find((e) => e.slug === slug);
  const date = params.get('date') ?? edition?.latest ?? null;

  const index = useAsync(() => (edition ? loadIndex(slug, manifest.updatedAt) : Promise.resolve([])), `${slug}|${manifest.updatedAt}`);
  const issue = useAsync(
    date && edition ? () => loadIssue(slug, date, manifest.updatedAt) : null,
    `${slug}|${date}|${manifest.updatedAt}`,
  );

  if (!edition) return <Navigate to="/" replace />;

  const accentStyle = { '--accent-l': edition.accent.light, '--accent-d': edition.accent.dark } as React.CSSProperties;
  const indexData = index.status === 'ready' ? index.data : [];

  let body: React.ReactNode;
  if (!date) {
    body = (
      <Notice title="The first issue is on its way">
        This edition has no issues yet. It is published each morning after arXiv’s announcement, whenever there are new papers that
        match its profile.
      </Notice>
    );
  } else if (issue.status === 'loading') {
    body = <p className="loading" aria-live="polite">Setting the type…</p>;
  } else if (issue.status === 'error') {
    body = (
      <Notice title="This issue could not be loaded">
        {params.get('date') ? `There is no ${edition.name} issue for ${date}. ` : ''}
        <Link to={`/${slug}`}>Go to the latest issue</Link>.
      </Notice>
    );
  } else {
    body = <IssueView issue={issue.data} slug={slug} index={indexData} />;
  }

  const current = issue.status === 'ready' ? issue.data : null;
  const pos = current ? indexData.findIndex((e) => e.date === current.date) : -1;
  const newer = pos > 0 ? indexData[pos - 1] : null;
  const older = pos >= 0 && pos < indexData.length - 1 ? indexData[pos + 1] : null;

  return (
    <div className="edition" style={accentStyle}>
      <Masthead
        manifest={manifest}
        tagline={edition.tagline}
        strapLeft={
          current ? (
            <>
              <span>{longDate(current.date)}</span>
              <span className="strap-sep">·</span>
              <span>
                {edition.name} · No. {current.number}
              </span>
            </>
          ) : (
            <span>{edition.name}</span>
          )
        }
        strapRight={
          <>
            {older && (
              <Link className="strap-button" to={`/${slug}?date=${older.date}`} aria-label={`Previous issue, ${older.date}`}>
                ← Prev
              </Link>
            )}
            {newer && (
              <Link className="strap-button" to={`/${slug}?date=${newer.date}`} aria-label={`Next issue, ${newer.date}`}>
                Next →
              </Link>
            )}
          </>
        }
      />
      <main>{body}</main>
    </div>
  );
}

function IssueView({ issue, slug, index }: { issue: Issue; slug: string; index: IssueIndexEntry[] }) {
  const lib = useLibrary();
  const [topic, setTopic] = useState<string | null>(null);
  const [hideRead, setHideRead] = useState(false);

  const { numbers, byId } = useMemo(() => {
    const numbers = new Map<string, number>();
    const byId = new Map<string, IssuePaper>();
    issue.papers.forEach((p, i) => {
      numbers.set(p.id, i + 1);
      byId.set(p.id, p);
    });
    return { numbers, byId };
  }, [issue]);

  const visible = (p: IssuePaper) => (!topic || p.topics.includes(topic)) && (!hideRead || !lib.isRead(p.id));
  const lead = issue.papers.filter((p) => p.tier === 'lead' && visible(p));
  const notable = issue.papers.filter((p) => p.tier === 'notable' && visible(p));
  const radar = issue.papers.filter((p) => p.tier === 'radar' && visible(p));
  const readCount = issue.papers.filter((p) => lib.isRead(p.id)).length;

  const entry = (p: IssuePaper, variant: 'lead' | 'notable') => (
    <PaperEntry
      key={p.id}
      paper={p}
      n={numbers.get(p.id)!}
      edition={slug}
      variant={variant}
      saved={lib.isSaved(p.id)}
      read={lib.isRead(p.id)}
      onToggleSaved={() => lib.toggleSaved(p, slug)}
      onToggleRead={() => lib.toggleRead(p.id)}
    />
  );

  return (
    <>
      <FrontPage issue={issue} numbers={numbers} papers={byId} />

      <div className="columns">
        <div className="papers">
          <div className="papers-head">
            <h2 className="section-heading">The papers</h2>
            <p className="papers-sub">
              {issue.stats.published} selected from {issue.stats.screened.toLocaleString('en')} new preprints
              {readCount > 0 && ` · ${readCount} read`}
            </p>
            <div className="papers-tools">
              {topic && (
                <button type="button" className="chip is-on" onClick={() => setTopic(null)}>
                  {topic} ✕
                </button>
              )}
              <label className="check">
                <input type="checkbox" checked={hideRead} onChange={(e) => setHideRead(e.target.checked)} />
                Hide read
              </label>
            </div>
          </div>

          {lead.length > 0 && (
            <section aria-label="Worth your morning">
              <h3 className="tier-heading">Worth your morning</h3>
              {lead.map((p) => entry(p, 'lead'))}
            </section>
          )}
          {notable.length > 0 && (
            <section aria-label="Also notable">
              <h3 className="tier-heading">Also notable</h3>
              <div className="notable-grid">{notable.map((p) => entry(p, 'notable'))}</div>
            </section>
          )}
          {radar.length > 0 && (
            <section aria-label="On the radar">
              <h3 className="tier-heading">On the radar</h3>
              <RadarList papers={radar} numbers={numbers} isRead={lib.isRead} />
            </section>
          )}
          {lead.length + notable.length + radar.length === 0 && (
            <p className="empty-filter">
              Nothing left to show with these filters.{' '}
              <button type="button" className="link-button" onClick={() => { setTopic(null); setHideRead(false); }}>
                Clear filters
              </button>
            </p>
          )}
        </div>

        <aside className="rail">
          <div className="rail-inner">
            <TopicIndex topics={issue.topics} active={topic} onSelect={setTopic} />
            <Dispatches items={issue.dispatches} />
            <Archive slug={slug} index={index} current={issue.date} />
          </div>
        </aside>
      </div>

      <Colophon issue={issue} />
    </>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="notice">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
