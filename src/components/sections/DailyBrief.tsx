import type { DailyDigest, Paper, NewsItem, Video, GitHubRepo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, Clock, TrendingUp, BookOpen, FileText, Newspaper, Video as VideoIcon, GitBranch, Link2, Sparkles } from 'lucide-react';

interface Props {
  digest: DailyDigest | null;
  loading: boolean;
  papers?: Paper[];
  news?: NewsItem[];
  videos?: Video[];
  github?: GitHubRepo[];
}

export function DailyBrief({
  digest,
  loading,
  papers = [],
  news = [],
  videos = [],
  github = [],
}: Props) {
  if (loading) {
    return (
      <section id="daily-brief" className="space-y-4" aria-label="Daily Brief">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </section>
    );
  }

  if (!digest || !digest.topDevelopments.length) {
    return (
      <section id="daily-brief" className="space-y-4" aria-label="Daily Brief">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold tracking-tight">Daily Brief</h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No digest available yet. Run the data pipeline to generate your first daily brief.</p>
            <p className="mt-2 text-sm">Use <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">npm run fetch:all</code> to get started.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Helper to resolve related items
  const getRelatedItem = (id: string) => {
    const paper = papers.find((p) => p.id === id);
    if (paper) return { type: 'paper' as const, title: paper.title, url: paper.url };

    const newsItem = news.find((n) => n.id === id);
    if (newsItem) return { type: 'news' as const, title: newsItem.title, url: newsItem.url };

    const video = videos.find((v) => v.id === id);
    if (video) return { type: 'video' as const, title: video.title, url: video.url };

    const repo = github.find((g) => g.id === id);
    if (repo) return { type: 'repo' as const, title: repo.fullName || repo.name, url: repo.url };

    return null;
  };

  // Helper to parse markdown text inline
  const renderItalics = (text: string) => {
    const italicParts = text.split(/\*([\s\S]*?)\*/g);
    return italicParts.map((part, k) => {
      if (k % 2 === 1) {
        return <em key={k} className="italic text-foreground/95">{part}</em>;
      }
      return part;
    });
  };

  const renderInlineMarkdown = (text: string) => {
    const boldParts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return boldParts.map((part, j) => {
      if (j % 2 === 1) {
        return (
          <strong key={j} className="font-semibold text-foreground">
            {renderItalics(part)}
          </strong>
        );
      }
      return renderItalics(part);
    });
  };

  const renderMarkdownText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2" />;

      // Header H3
      if (trimmed.startsWith('### ')) {
        const content = trimmed.substring(4);
        return (
          <h3 key={i} className="text-sm font-bold text-foreground uppercase tracking-wider mt-5 mb-2.5 first:mt-0 flex items-center gap-1.5 border-b border-border/40 pb-1.5">
            {renderInlineMarkdown(content)}
          </h3>
        );
      }

      // Header H4
      if (trimmed.startsWith('#### ')) {
        const content = trimmed.substring(5);
        return (
          <h4 key={i} className="text-xs font-bold text-foreground/90 uppercase mt-4 mb-2">
            {renderInlineMarkdown(content)}
          </h4>
        );
      }

      // List item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        const indentClass = line.startsWith('  ') ? 'pl-6' : 'pl-3';
        return (
          <div key={i} className={`flex items-start gap-2 text-sm text-muted-foreground leading-relaxed py-0.5 ${indentClass}`}>
            <span className="text-amber-500 mt-1.5 select-none">•</span>
            <div className="flex-1">{renderInlineMarkdown(content)}</div>
          </div>
        );
      }

      // Indented list item
      if (trimmed.startsWith('  - ')) {
        const content = trimmed.substring(4);
        return (
          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed pl-8 py-0.5">
            <span className="text-muted-foreground/60 mt-1.5 select-none">◦</span>
            <div className="flex-1">{renderInlineMarkdown(content)}</div>
          </div>
        );
      }

      // Numbered item
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const num = numMatch[1];
        const content = numMatch[2];
        return (
          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed py-0.5 pl-3">
            <span className="text-amber-600 dark:text-amber-400 font-mono font-bold text-xs mt-1 select-none">{num}.</span>
            <div className="flex-1">{renderInlineMarkdown(content)}</div>
          </div>
        );
      }

      // Default paragraph
      return (
        <p key={i} className="text-sm md:text-base text-muted-foreground leading-relaxed mt-2 first:mt-0">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  return (
    <section id="daily-brief" className="space-y-6" aria-label="Daily Brief">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500 animate-pulse" />
          <h2 className="text-2xl font-bold tracking-tight">Daily Brief</h2>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {digest.estimatedReadingTime} min read
          </span>
          <span>{new Date(digest.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Executive Briefing */}
      {digest.summary && (
        <Card className="border border-border/80 bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border/50 bg-muted/30 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold tracking-tight uppercase text-foreground/80">Executive Briefing</h3>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5 border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5">
              Analyst Report
            </Badge>
          </div>
          <CardContent className="p-6 space-y-3">
            {renderMarkdownText(digest.summary)}
          </CardContent>
        </Card>
      )}

      {/* Top Developments Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {digest.topDevelopments.map((dev) => {
          const resolvedItems = (dev.relatedItemIds || [])
            .map(getRelatedItem)
            .filter((item): item is NonNullable<typeof item> => item !== null);

          return (
            <Card
              key={dev.rank}
              className="group relative flex flex-col justify-between overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 border border-muted hover:border-primary/20"
            >
              <div>
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                      {dev.rank}
                    </span>
                    <div className="flex gap-1">
                      {dev.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs bg-muted/60 hover:bg-muted text-muted-foreground transition-colors">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <CardTitle className="mt-2 text-base leading-snug font-bold group-hover:text-primary transition-colors">{dev.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground leading-relaxed">{dev.summary}</p>
                  <div className="space-y-2 border-t pt-3 mt-1 border-muted/50">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Significance</span>
                        <p className="text-xs text-foreground/80 leading-relaxed">{dev.whyItMatters}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Expected Impact</span>
                        <p className="text-xs text-foreground/80 leading-relaxed">{dev.expectedImpact}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* References Section */}
              {resolvedItems.length > 0 && (
                <div className="px-6 pb-5 pt-3 border-t border-muted/40 bg-muted/10">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Sources & References
                  </div>
                  <div className="space-y-1.5">
                    {resolvedItems.map((ref) => (
                      <a
                        key={ref.url}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 p-2 rounded bg-background hover:bg-muted border border-muted/60 text-xs transition-all duration-200 hover:border-primary/30 group/ref"
                      >
                        <span className="truncate font-medium text-muted-foreground group-hover/ref:text-primary transition-colors flex items-center gap-2">
                          {ref.type === 'paper' && <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          {ref.type === 'news' && <Newspaper className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {ref.type === 'video' && <VideoIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                          {ref.type === 'repo' && <GitBranch className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
                          <span className="truncate max-w-[160px] sm:max-w-[200px] md:max-w-[220px]">{ref.title}</span>
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize border-muted font-normal shrink-0">
                          {ref.type}
                        </Badge>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
