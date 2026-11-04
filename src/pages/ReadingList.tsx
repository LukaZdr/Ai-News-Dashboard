import { useState } from 'react';
import type { Manifest } from '@/types';
import { Masthead } from '@/components/Masthead';
import { useLibrary, type SavedPaper } from '@/lib/library';
import { bibtex, formatAuthors, shortDate } from '@/lib/format';

export function ReadingList({ manifest }: { manifest: Manifest }) {
  const lib = useLibrary();
  const [copied, setCopied] = useState<string | null>(null);
  const all = Object.values(lib.state.saved).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const unread = all.filter((p) => !lib.isRead(p.id));
  const done = all.filter((p) => lib.isRead(p.id));
  const editionName = (slug: string) => manifest.editions.find((e) => e.slug === slug)?.name ?? slug;

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied('error');
    }
    setTimeout(() => setCopied(null), 2200);
  };

  const row = (p: SavedPaper) => (
    <li key={p.id} className={`saved${lib.isRead(p.id) ? ' is-read' : ''}`}>
      <p className="entry-meta">
        <span className="entry-topic">{editionName(p.edition)}</span>
        <span className="entry-id">{p.id}</span>
        <span>saved {shortDate(p.savedAt)}</span>
      </p>
      <h3 className="entry-title">
        <a href={p.url} target="_blank" rel="noreferrer">
          {p.title}
        </a>
      </h3>
      <p className="entry-authors">{formatAuthors(p.authors)}</p>
      {p.why && <p className="entry-why">{p.why}</p>}
      <div className="entry-actions">
        <a href={p.pdfUrl} target="_blank" rel="noreferrer">
          PDF
        </a>
        <button type="button" onClick={() => copy(p.id, bibtex(p))}>
          {copied === p.id ? 'Copied' : 'BibTeX'}
        </button>
        <span className="entry-actions-spacer" />
        <button type="button" className={`toggle${lib.isRead(p.id) ? ' is-on' : ''}`} onClick={() => lib.toggleRead(p.id)}>
          {lib.isRead(p.id) ? '✓ Read' : 'Mark read'}
        </button>
        <button type="button" className="toggle" onClick={() => lib.removeSaved(p.id)}>
          Remove
        </button>
      </div>
    </li>
  );

  return (
    <div className="edition edition--list">
      <Masthead manifest={manifest} strapLeft={<span>Your reading list</span>} tagline="Papers you saved, across every edition." />
      <main className="reading-list">
        {all.length === 0 ? (
          <div className="notice">
            <h2>Nothing saved yet</h2>
            <p>Use “☆ Save” on any paper to keep it here. Your list lives in this browser only.</p>
          </div>
        ) : (
          <>
            <div className="papers-head">
              <h2 className="section-heading">To read</h2>
              <p className="papers-sub">
                {unread.length} waiting · {done.length} read
              </p>
              <div className="papers-tools">
                <button type="button" className="chip" onClick={() => copy('all', all.map(bibtex).join('\n\n'))}>
                  {copied === 'all' ? 'Copied all' : `Copy BibTeX for all ${all.length}`}
                </button>
                {copied === 'error' && <span className="papers-sub">Clipboard unavailable</span>}
              </div>
            </div>
            <ul className="saved-list">{unread.map(row)}</ul>
            {done.length > 0 && (
              <>
                <h3 className="tier-heading">Read</h3>
                <ul className="saved-list">{done.map(row)}</ul>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
