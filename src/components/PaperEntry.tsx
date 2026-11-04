import { useState } from 'react';
import type { IssuePaper } from '@/types';
import { firstSentences, formatAuthors } from '@/lib/format';

interface Props {
  paper: IssuePaper;
  n: number;
  edition: string;
  variant: 'lead' | 'notable';
  saved: boolean;
  read: boolean;
  onToggleSaved: () => void;
  onToggleRead: () => void;
}

export function PaperEntry({ paper, n, variant, saved, read, onToggleSaved, onToggleRead }: Props) {
  const [open, setOpen] = useState(false);
  const preview = variant === 'lead' ? firstSentences(paper.abstract, 2) : '';
  const hasMore = paper.abstract.length > preview.length + 10;

  return (
    <article id={`p-${paper.id}`} className={`entry entry--${variant}${read ? ' is-read' : ''}`}>
      <div className="entry-meta">
        <span className="entry-n">{n}</span>
        {paper.topics.slice(0, 2).map((t) => (
          <span key={t} className="entry-topic">
            {t}
          </span>
        ))}
        <span className="entry-id">{paper.id}</span>
        {paper.hf && (
          <span className="entry-hf" title="Upvotes on Hugging Face Daily Papers">
            ▲ {paper.hf.upvotes}
          </span>
        )}
        {paper.hf?.organization && <span className="entry-org">{paper.hf.organization}</span>}
      </div>

      <h3 className="entry-title">
        <a href={paper.url} target="_blank" rel="noreferrer">
          {paper.title}
        </a>
      </h3>
      <p className="entry-authors">{formatAuthors(paper.authors)}</p>
      {paper.why && <p className="entry-why">{paper.why}</p>}

      {(preview || open) && (
        <p className="entry-abstract">{open ? paper.abstract : preview}</p>
      )}

      <div className="entry-actions">
        {(hasMore || variant === 'notable') && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Less' : variant === 'notable' ? 'Abstract' : 'Full abstract'}
          </button>
        )}
        <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
          PDF
        </a>
        {paper.hf && (
          <a href={`https://huggingface.co/papers/${paper.id}`} target="_blank" rel="noreferrer">
            Discussion
          </a>
        )}
        {paper.hf?.githubRepo && (
          <a href={paper.hf.githubRepo} target="_blank" rel="noreferrer">
            Code
          </a>
        )}
        <span className="entry-actions-spacer" />
        <button type="button" className={`toggle${saved ? ' is-on' : ''}`} onClick={onToggleSaved} aria-pressed={saved}>
          {saved ? '★ Saved' : '☆ Save'}
        </button>
        <button type="button" className={`toggle${read ? ' is-on' : ''}`} onClick={onToggleRead} aria-pressed={read}>
          {read ? '✓ Read' : 'Mark read'}
        </button>
      </div>
    </article>
  );
}

export function RadarList({ papers, numbers, isRead }: { papers: IssuePaper[]; numbers: Map<string, number>; isRead: (id: string) => boolean }) {
  return (
    <ol className="radar">
      {papers.map((p) => (
        <li key={p.id} id={`p-${p.id}`} className={isRead(p.id) ? 'is-read' : undefined}>
          <span className="entry-n">{numbers.get(p.id)}</span>
          <a href={p.url} target="_blank" rel="noreferrer" title={p.why}>
            {p.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
