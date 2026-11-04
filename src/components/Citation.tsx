import { Fragment } from 'react';
import type { IssuePaper } from '@/types';
import { splitCitations } from '@/lib/format';
import { scrollToPaper } from '@/lib/scroll';

/** Renders prose, turning [arXiv-id] into numbered references to entries on the page. */
export function CitedText({ text, numbers, papers }: { text: string; numbers: Map<string, number>; papers: Map<string, IssuePaper> }) {
  return (
    <>
      {splitCitations(text).map((part, i) => {
        if ('text' in part) return <Fragment key={i}>{part.text}</Fragment>;
        const n = numbers.get(part.cite);
        const paper = papers.get(part.cite);
        if (!n || !paper) {
          // Unknown id: link straight to arXiv rather than dropping it.
          return (
            <a key={i} className="cite" href={`https://arxiv.org/abs/${part.cite}`} target="_blank" rel="noreferrer">
              {part.cite}
            </a>
          );
        }
        return (
          <button key={i} type="button" className="cite" title={paper.title} onClick={() => scrollToPaper(part.cite)}>
            {n}
          </button>
        );
      })}
    </>
  );
}
