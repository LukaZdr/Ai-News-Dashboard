import { useState, useMemo } from 'react';
import type { NewsletterItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Mail, ExternalLink, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  newsletters: NewsletterItem[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string, type: 'newsletter') => void;
  selectedTopics: string[];
}

const NEWSLETTER_METADATA: Record<string, { focus: string; quality: number }> = {
  "The Batch": { focus: "Weekly AI research & industry", quality: 5 },
  "Import AI": { focus: "AI strategy & research", quality: 5 },
  "Ben's Bites": { focus: "Daily AI news", quality: 4 },
  "TLDR AI": { focus: "Daily AI news", quality: 4 },
  "The Rundown AI": { focus: "AI products & news", quality: 4 },
  "Latent Space": { focus: "LLMs, infrastructure, engineering", quality: 5 },
  "Interconnects": { focus: "LLM research & analysis", quality: 5 },
  "Simon Willison's Weblog": { focus: "Practical LLM developments", quality: 5 },
  "Hugging Face Blog": { focus: "Models, research, releases", quality: 5 },
};

export function NewslettersSection({ newsletters, loading, isBookmarked, toggleBookmark, selectedTopics }: Props) {
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const [selectedNewsletter, setSelectedNewsletter] = useState<NewsletterItem | null>(null);

  const sources = useMemo(() => {
    const list = new Set(newsletters.map((n) => n.source));
    // Ensure all config sources are available in the dropdown
    Object.keys(NEWSLETTER_METADATA).forEach(name => list.add(name));
    return Array.from(list).sort();
  }, [newsletters]);

  const filtered = useMemo(() => {
    let result = newsletters;
    if (selectedTopics.length > 0) {
      result = result.filter((n) => n.tags.some((t) => selectedTopics.includes(t)));
    }
    if (selectedSource !== 'all') {
      result = result.filter((n) => n.source === selectedSource);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q) ||
        (n.content && n.content.toLowerCase().includes(q))
      );
    }
    return result;
  }, [newsletters, selectedTopics, selectedSource, search]);

  const displayed = showAll ? filtered : filtered.slice(0, 12);

  if (loading) {
    return (
      <section id="newsletters" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </section>
    );
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <section id="newsletters" className="space-y-4">
      {/* Directory & Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-indigo-500" />
          <h2 className="text-2xl font-bold tracking-tight">AI Newsletters</h2>
          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-none">
            {filtered.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Newsletters</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            placeholder="Search newsletters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40"
          />
        </div>
      </div>

      {/* Grid of Newsletter Issues */}
      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No newsletter items found. {newsletters.length === 0 ? 'Run the newsletters fetcher script to retrieve updates.' : 'Try adjusting filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {displayed.map((item) => {
            const meta = NEWSLETTER_METADATA[item.source] || { focus: 'AI news', quality: item.quality || 4 };
            const isFiveStar = meta.quality === 5;
            const isMockUrl = !item.url || item.url.includes('example.com') || item.url.includes('/mock/');
            return (
              <Card 
                key={item.id} 
                className={`group transition-all hover:shadow-md ${
                  isFiveStar 
                    ? 'border-indigo-200 dark:border-indigo-950/60 bg-gradient-to-br from-background via-background to-indigo-50/20 dark:to-indigo-950/10'
                    : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {item.source}
                        </span>
                        {renderStars(meta.quality)}
                      </div>
                      {isMockUrl ? (
                        <button
                          onClick={() => setSelectedNewsletter(item)}
                          className="block text-left font-semibold leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group/title"
                        >
                          {item.title}
                          <span className="ml-2 inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-300/10">
                            Read Full Text
                          </span>
                        </button>
                      ) : (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block font-semibold leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          {item.title}
                          <ExternalLink className="ml-1 inline h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => toggleBookmark(item.id, 'newsletter')}
                      className="shrink-0 text-muted-foreground hover:text-indigo-500 transition-colors"
                    >
                      {isBookmarked(item.id) ? (
                        <BookmarkCheck className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {item.summary}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] bg-background">
                          {tag}
                        </Badge>
                      ))}
                      {item.readTime && (
                        <Badge variant="secondary" className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-muted-foreground border-none">
                          {item.readTime}
                        </Badge>
                      )}
                    </div>
                    {item.date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length > 12 && (
        <Button
          variant="ghost"
          className="w-full text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="mr-1 h-4 w-4" /> Show less</>
          ) : (
            <><ChevronDown className="mr-1 h-4 w-4" /> Show all {filtered.length} newsletter items</>
          )}
        </Button>
      )}

      <Dialog open={!!selectedNewsletter} onOpenChange={(open) => !open && setSelectedNewsletter(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedNewsletter && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span>{selectedNewsletter.source}</span>
                  {selectedNewsletter.readTime && <span>• {selectedNewsletter.readTime}</span>}
                  {selectedNewsletter.date && (
                    <span>• {new Date(selectedNewsletter.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                </div>
                <DialogTitle className="text-xl font-bold mt-1 text-foreground">
                  {selectedNewsletter.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Full text of the newsletter issue from {selectedNewsletter.source}.
                </DialogDescription>
              </DialogHeader>
              
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t pt-4">
                {selectedNewsletter.content || selectedNewsletter.summary}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-2">
                {selectedNewsletter.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="bg-background">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
