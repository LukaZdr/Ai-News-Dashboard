import { useState, useMemo } from 'react';
import type { Video } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Video as VideoIcon, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  videos: Video[];
  loading: boolean;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string, type: 'video') => void;
  selectedTopics: string[];
}

export function VideosSection({ videos, loading, isBookmarked, toggleBookmark, selectedTopics }: Props) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    let result = videos;
    if (selectedTopics.length > 0) {
      result = result.filter((v) => v.tags.some((t) => selectedTopics.includes(t)));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((v) =>
        v.title.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [videos, selectedTopics, search]);

  const displayed = showAll ? filtered : filtered.slice(0, 8);

  if (loading) {
    return (
      <section id="videos" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </section>
    );
  }

  return (
    <section id="videos" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VideoIcon className="h-6 w-6 text-red-500" />
          <h2 className="text-2xl font-bold tracking-tight">AI Videos & Explaners</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48"
          />
        </div>
      </div>

      {displayed.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No videos found. {videos.length === 0 ? 'Run the data pipeline to fetch videos.' : 'Try adjusting filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayed.map((video) => (
            <Card key={video.id} className="group overflow-hidden transition-all hover:shadow-md">
              <div className="relative aspect-video w-full bg-muted">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
                    <Play className="h-5 w-5 fill-current" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-mono font-medium text-white">
                  {video.duration}
                </span>
                <span className="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                  ★ {video.relevanceScore}
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-1.5">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-sm font-medium hover:text-primary leading-tight"
                  >
                    {video.title}
                  </a>
                  <button
                    onClick={() => toggleBookmark(video.id, 'video')}
                    className="shrink-0 text-muted-foreground hover:text-primary mt-0.5"
                  >
                    {isBookmarked(video.id) ? (
                      <BookmarkCheck className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{video.channel}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex gap-1 overflow-hidden">
                    {video.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 leading-none h-4">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {video.date && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(video.date).toLocaleDateString()}
                    </span>
                  )}
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
            <><ChevronDown className="mr-1 h-4 w-4" /> Show all {filtered.length} videos</>
          )}
        </Button>
      )}
    </section>
  );
}
