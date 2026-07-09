import { useState, useMemo } from 'react';
import type { Paper } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { FileText, ExternalLink, Bookmark, BookmarkCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  papers: Paper[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string, type: 'paper') => void;
  selectedTopics: string[];
}

export function PapersSection({ papers, loading, isBookmarked, toggleBookmark, selectedTopics }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'importance'>('date');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let result = papers;
    if (selectedTopics.length > 0) {
      result = result.filter((p) => p.tags.some((t) => selectedTopics.includes(t)));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.abstract.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q))
      );
    }
    result = [...result].sort((a, b) =>
      sortBy === 'date'
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : b.importance - a.importance
    );
    return result;
  }, [papers, selectedTopics, search, sortBy]);

  const displayed = showAll ? filtered : filtered.slice(0, 12);

  if (loading) {
    return (
      <section id="papers" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </section>
    );
  }

  return (
    <section id="papers" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold tracking-tight">Research Papers</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search papers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortBy(sortBy === 'date' ? 'importance' : 'date')}
            className="text-xs"
          >
            Sort: {sortBy === 'date' ? '📅 Date' : '⭐ Importance'}
          </Button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No papers found. {papers.length === 0 ? 'Run the data pipeline to fetch papers.' : 'Try adjusting filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {displayed.map((paper) => (
            <Card key={paper.id} className="group transition-all hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-medium leading-snug hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {paper.title}
                    <ExternalLink className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
                  </a>
                  <button
                    onClick={() => toggleBookmark(paper.id, 'paper')}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    {isBookmarked(paper.id) ? (
                      <BookmarkCheck className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {paper.authors.slice(0, 3).join(', ')}
                  {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{paper.abstract}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {paper.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{paper.source}</Badge>
                    {paper.date && (
                      <span>{new Date(paper.date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > 12 && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="mr-1 h-4 w-4" /> Show less</>
          ) : (
            <><ChevronDown className="mr-1 h-4 w-4" /> Show all {filtered.length} papers</>
          )}
        </Button>
      )}
    </section>
  );
}
