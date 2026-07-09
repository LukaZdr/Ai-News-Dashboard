import { useState, useMemo } from 'react';
import type { GitHubRepo } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { GitBranch, Star, ExternalLink, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  repos: GitHubRepo[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string, type: 'github') => void;
  selectedTopics: string[];
}

export function GithubSection({ repos, loading, isBookmarked, toggleBookmark, selectedTopics }: Props) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let result = repos;
    if (selectedTopics.length > 0) {
      result = result.filter((r) => r.tags.some((t) => selectedTopics.includes(t)));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [repos, selectedTopics, search]);

  const displayed = showAll ? filtered : filtered.slice(0, 8);

  if (loading) {
    return (
      <section id="github" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </section>
    );
  }

  return (
    <section id="github" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-indigo-500" />
          <h2 className="text-2xl font-bold tracking-tight">GitHub Projects & Releases</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search repos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48"
          />
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No repositories found. {repos.length === 0 ? 'Run the data pipeline to fetch repos.' : 'Try adjusting filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {displayed.map((repo) => (
            <Card key={repo.id} className="group transition-all hover:shadow-md">
              <CardContent className="p-4 flex flex-col justify-between h-full min-h-[140px]">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 font-semibold leading-snug hover:text-primary"
                    >
                      {repo.fullName}
                      <ExternalLink className="ml-1 inline h-3 w-3 opacity-0 group-hover:opacity-50" />
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                        {repo.stars.toLocaleString()}
                      </span>
                      <button
                        onClick={() => toggleBookmark(repo.id, 'github')}
                        className="shrink-0 text-muted-foreground hover:text-primary"
                      >
                        {isBookmarked(repo.id) ? (
                          <BookmarkCheck className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{repo.description}</p>
                </div>

                <div className="mt-4 space-y-2">
                  {repo.latestRelease && (
                    <div className="rounded-md bg-muted/50 p-2 text-xs border">
                      <div className="flex items-center gap-1.5 font-medium text-primary">
                        <Tag className="h-3.5 w-3.5" />
                        <span>Latest Release: {repo.latestRelease.tag}</span>
                        {repo.latestRelease.date && (
                          <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                            {new Date(repo.latestRelease.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {repo.latestRelease.notes && (
                        <p className="mt-1 line-clamp-2 text-muted-foreground text-[11px] leading-relaxed">
                          {repo.latestRelease.notes.replace(/[\r\n]+/g, ' ')}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {repo.language && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 leading-none h-4">
                          {repo.language}
                        </Badge>
                      )}
                      {repo.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 leading-none h-4">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {repo.recentActivity && (
                      <span className="text-[10px] text-muted-foreground">
                        Updated {new Date(repo.recentActivity).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > 8 && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <><ChevronUp className="mr-1 h-4 w-4" /> Show less</>
          ) : (
            <><ChevronDown className="mr-1 h-4 w-4" /> Show all {filtered.length} repositories</>
          )}
        </Button>
      )}
    </section>
  );
}
