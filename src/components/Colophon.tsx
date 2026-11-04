import type { Issue } from '@/types';
import { longDate } from '@/lib/format';

export function Colophon({ issue }: { issue: Issue }) {
  const { stats, editor } = issue;
  return (
    <footer className="colophon">
      <h2 className="rail-heading">How this issue was made</h2>
      <p>
        {stats.announcedOn ? `arXiv’s announcement of ${longDate(stats.announcedOn)}` : 'The latest arXiv announcement'} and
        Hugging Face Daily Papers supplied {stats.screened.toLocaleString('en')} new preprints (revisions of older papers are
        dropped). {stats.matched.toLocaleString('en')} matched this edition’s profile
        {stats.alreadyFeatured > 0 && `, ${stats.alreadyFeatured} had already appeared in an earlier issue`}, and{' '}
        {stats.published} made the cut.{' '}
        {editor.mode === 'llm'
          ? `Ranking and the editor’s note were produced by ${editor.model}, working only from titles and abstracts — check the paper before you cite it.`
          : 'No language model was used today: papers are ranked by topic match and community upvotes.'}
        {editor.note && ` ${editor.note}`}
      </p>
      <p className="colophon-small">
        Generated {new Date(issue.generatedAt).toUTCString().replace(' GMT', ' UTC')}. Saved papers and read marks stay in this
        browser.
      </p>
    </footer>
  );
}
