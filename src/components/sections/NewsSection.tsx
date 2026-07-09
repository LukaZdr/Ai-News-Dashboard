import { useState, useMemo } from 'react';
import type { NewsItem, CompanyConfig } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Newspaper, ExternalLink, Bookmark, BookmarkCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import companiesConfig from '../../../config/companies.json';

interface Props {
  news: NewsItem[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string, type: 'news') => void;
  selectedTopics: string[];
}

export function NewsSection({ news, loading, isBookmarked, toggleBookmark, selectedTopics }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const companiesMap = useMemo(() => {
    return new Map<string, CompanyConfig>(
      companiesConfig.companies.map((c) => [c.slug, c as unknown as CompanyConfig])
    );
  }, []);

  const filtered = useMemo(() => {
    let result = news;
    if (selectedTopics.length > 0) {
      result = result.filter((n) => n.tags.some((t) => selectedTopics.includes(t)));
    }
    if (selectedCompany !== 'all') {
      result = result.filter((n) => n.company === selectedCompany);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.source.toLowerCase().includes(q)
      );
    }
    return result;
  }, [news, selectedTopics, selectedCompany, search]);

  const displayed = showAll ? filtered : filtered.slice(0, 12);

  if (loading) {
    return (
      <section id="news" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </section>
    );
  }

  return (
    <section id="news" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-emerald-500" />
          <h2 className="text-2xl font-bold tracking-tight">Company News</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Companies</option>
            {companiesConfig.companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Search news..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40"
          />
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No news items found. {news.length === 0 ? 'Run the data pipeline to fetch news.' : 'Try adjusting filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {displayed.map((item) => {
            const companyInfo = companiesMap.get(item.company);
            return (
              <Card key={item.id} className="group transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 font-medium leading-snug hover:text-primary"
                    >
                      {item.title}
                      <ExternalLink className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
                    </a>
                    <button
                      onClick={() => toggleBookmark(item.id, 'news')}
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      {isBookmarked(item.id) ? (
                        <BookmarkCheck className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        style={{
                          borderColor: companyInfo?.color,
                          color: companyInfo?.color,
                        }}
                        variant="outline"
                        className="text-[10px] bg-background"
                      >
                        {item.source}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.type}
                      </Badge>
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {item.date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()}
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
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="mr-1 h-4 w-4" /> Show less</>
          ) : (
            <><ChevronDown className="mr-1 h-4 w-4" /> Show all {filtered.length} news items</>
          )}
        </Button>
      )}
    </section>
  );
}
