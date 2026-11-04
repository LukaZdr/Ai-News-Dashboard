import { Link } from 'react-router-dom';
import type { Dispatch, Issue, IssueIndexEntry } from '@/types';
import { shortDate } from '@/lib/format';

export function TopicIndex({
  topics,
  active,
  onSelect,
}: {
  topics: Issue['topics'];
  active: string | null;
  onSelect: (t: string | null) => void;
}) {
  if (topics.length === 0) return null;
  return (
    <section className="rail-block">
      <h2 className="rail-heading">In this issue</h2>
      <ul className="topic-index">
        {topics.map((t) => (
          <li key={t.name}>
            <button
              type="button"
              className={active === t.name ? 'is-active' : undefined}
              aria-pressed={active === t.name}
              onClick={() => onSelect(active === t.name ? null : t.name)}
            >
              <span>{t.name}</span>
              <span className="leader" aria-hidden="true" />
              <span className="topic-count">{t.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Dispatches({ items }: { items: Dispatch[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rail-block">
      <h2 className="rail-heading">Dispatches</h2>
      <p className="rail-sub">From the labs and the better newsletters.</p>
      <ul className="dispatches">
        {items.map((d) => (
          <li key={d.id}>
            <p className="dispatch-source">
              {d.source} · {shortDate(d.date)}
            </p>
            <a className="dispatch-title" href={d.url} target="_blank" rel="noreferrer">
              {d.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Archive({ slug, index, current }: { slug: string; index: IssueIndexEntry[]; current: string }) {
  if (index.length <= 1) return null;
  return (
    <section className="rail-block">
      <h2 className="rail-heading">Back issues</h2>
      <ul className="archive">
        {index.slice(0, 10).map((e) => (
          <li key={e.date} className={e.date === current ? 'is-current' : undefined}>
            <Link to={`/${slug}?date=${e.date}`}>
              <span className="archive-date">
                No. {e.number} · {shortDate(e.date)}
              </span>
              <span className="archive-headline">{e.headline}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
