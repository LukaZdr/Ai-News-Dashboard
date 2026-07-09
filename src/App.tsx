import { useState, useMemo, useEffect } from 'react';
import { useData } from '@/hooks/useData';
import { usePreferences } from '@/hooks/usePreferences';
import { useSearch } from '@/hooks/useSearch';
import { Header } from '@/components/Header';
import { DailyBrief } from '@/components/sections/DailyBrief';
import { TrendsSection } from '@/components/sections/TrendsSection';
import { PapersSection } from '@/components/sections/PapersSection';
import { NewsSection } from '@/components/sections/NewsSection';
import { VideosSection } from '@/components/sections/VideosSection';
import { GithubSection } from '@/components/sections/GithubSection';
import { NewslettersSection } from '@/components/sections/NewslettersSection';
import { BenchmarksSection } from '@/components/sections/BenchmarksSection';
import { DatePicker } from '@/components/DatePicker';
import { Bookmark, Sparkles, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function App() {
  const { papers, news, videos, github, newsletters, benchmarks, digest, trends, loading, error, reload, availableDates, selectedDate, setSelectedDate } = useData();
  const {
    prefs,
    toggleBookmark,
    isBookmarked,
    toggleTopic,
    clearTopics,
    toggleDarkMode,
  } = usePreferences();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterBookmarkedOnly, setFilterBookmarkedOnly] = useState(false);

  const { search } = useSearch(papers, news, videos, github, newsletters);

  // Apply dark mode class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (prefs.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [prefs.darkMode]);

  const searchResults = useMemo(() => {
    return search(searchQuery);
  }, [searchQuery, search]);

  // Compute filtered items for individual sections
  const filteredPapers = useMemo(() => {
    let list = papers;
    if (filterBookmarkedOnly) {
      list = list.filter((p) => isBookmarked(p.id));
    }
    return list;
  }, [papers, filterBookmarkedOnly, isBookmarked]);

  const filteredNews = useMemo(() => {
    let list = news;
    if (filterBookmarkedOnly) {
      list = list.filter((n) => isBookmarked(n.id));
    }
    return list;
  }, [news, filterBookmarkedOnly, isBookmarked]);

  const filteredVideos = useMemo(() => {
    let list = videos;
    if (filterBookmarkedOnly) {
      list = list.filter((v) => isBookmarked(v.id));
    }
    return list;
  }, [videos, filterBookmarkedOnly, isBookmarked]);

  const filteredGithub = useMemo(() => {
    let list = github;
    if (filterBookmarkedOnly) {
      list = list.filter((g) => isBookmarked(g.id));
    }
    return list;
  }, [github, filterBookmarkedOnly, isBookmarked]);

  const filteredNewsletters = useMemo(() => {
    let list = newsletters;
    if (filterBookmarkedOnly) {
      list = list.filter((nl) => isBookmarked(nl.id));
    }
    return list;
  }, [newsletters, filterBookmarkedOnly, isBookmarked]);

  const totalCount =
    filteredPapers.length +
    filteredNews.length +
    filteredVideos.length +
    filteredGithub.length +
    filteredNewsletters.length;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        selectedTopics={prefs.selectedTopics}
        onToggleTopic={toggleTopic}
        onClearTopics={clearTopics}
        filterBookmarkedOnly={filterBookmarkedOnly}
        onToggleBookmarkedOnly={() => setFilterBookmarkedOnly(!filterBookmarkedOnly)}
        darkMode={prefs.darkMode}
        onToggleDarkMode={toggleDarkMode}
        onReload={reload}
        isReloading={loading}
      />

      <main className="container mx-auto max-w-7xl px-4 py-6 space-y-8 animate-fade-in">
        {error && (
          <Card className="border-red-500/50 bg-red-500/5 text-red-500">
            <CardContent className="p-4 flex items-center justify-between text-sm">
              <span>⚠ Failed to load data feed: {error}</span>
              <button onClick={reload} className="underline hover:no-underline font-semibold">
                Retry
              </button>
            </CardContent>
          </Card>
        )}

        {/* Hero Welcome banner */}
        {!filterBookmarkedOnly && (
          <div className="relative rounded-2xl overflow-hidden bg-muted/30 border border-muted/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight flex flex-col md:flex-row md:items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  {selectedDate === 'latest' ? 'Good morning! Your AI Newspaper is ready' : `AI Newspaper Snapshot: ${selectedDate}`}
                </span>
                
                {availableDates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <DatePicker 
                      availableDates={availableDates}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                    />
                    {selectedDate !== 'latest' && (
                      <button 
                        onClick={() => setSelectedDate('latest')}
                        className="text-xs px-2.5 py-1.5 h-9 bg-primary/10 text-primary font-semibold rounded-md hover:bg-primary/20 transition-colors"
                      >
                        Today
                      </button>
                    )}
                  </div>
                )}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Here are the top developments in AI. We parsed arXiv research, top developer repos, youtube videos, and industry blogs to summarize today's news.
              </p>
            </div>
            {digest && (
              <div className="flex gap-4 items-center self-start md:self-auto">
                <div className="text-center bg-background border rounded-lg px-3 py-1.5 shrink-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">Reading Time</div>
                  <div className="text-base font-bold text-primary flex items-center gap-1 justify-center">
                    <BookOpen className="h-4 w-4" />
                    {digest.estimatedReadingTime}m
                  </div>
                </div>
                <div className="text-center bg-background border rounded-lg px-3 py-1.5 shrink-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">Topics Tracked</div>
                  <div className="text-base font-bold text-primary">
                    {trends?.topics.length || 0}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trends Section */}
        {!filterBookmarkedOnly && trends && (
          <TrendsSection
            topicClusters={trends.topics}
            loading={loading}
            selectedTopics={prefs.selectedTopics}
            onToggleTopic={toggleTopic}
          />
        )}

        {/* Daily Brief */}
        {!filterBookmarkedOnly && (
          <DailyBrief
            digest={digest}
            loading={loading}
            papers={papers}
            news={news}
            videos={videos}
            github={github}
          />
        )}

        {/* Filter bookmark banner */}
        {filterBookmarkedOnly && (
          <div className="flex items-center gap-2 border-b pb-4">
            <Bookmark className="h-6 w-6 text-amber-500 fill-current" />
            <h2 className="text-2xl font-bold">Your Saved Items</h2>
            <Badge variant="secondary">{totalCount} items</Badge>
          </div>
        )}

        {/* Core Content Feed Grid */}
        <div className="space-y-6">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-7 max-w-2xl mb-6 bg-muted/50 p-1">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="papers" className="text-xs">Papers</TabsTrigger>
              <TabsTrigger value="news" className="text-xs">News</TabsTrigger>
              <TabsTrigger value="videos" className="text-xs">Videos</TabsTrigger>
              <TabsTrigger value="github" className="text-xs">GitHub</TabsTrigger>
              <TabsTrigger value="newsletters" className="text-xs">Newsletters</TabsTrigger>
              <TabsTrigger value="benchmarks" className="text-xs">Benchmarks</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-8 outline-none">
              <div className="grid gap-8">
                <PapersSection
                  papers={filteredPapers}
                  loading={loading}
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  selectedTopics={prefs.selectedTopics}
                />
                <NewslettersSection
                  newsletters={filteredNewsletters}
                  loading={loading}
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  selectedTopics={prefs.selectedTopics}
                />
                <NewsSection
                  news={filteredNews}
                  loading={loading}
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  selectedTopics={prefs.selectedTopics}
                />
                <VideosSection
                  videos={filteredVideos}
                  loading={loading}
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  selectedTopics={prefs.selectedTopics}
                />
                <GithubSection
                  repos={filteredGithub}
                  loading={loading}
                  isBookmarked={isBookmarked}
                  toggleBookmark={toggleBookmark}
                  selectedTopics={prefs.selectedTopics}
                />
                <BenchmarksSection
                  benchmarks={benchmarks}
                  loading={loading}
                />
              </div>
            </TabsContent>

            <TabsContent value="papers" className="outline-none">
              <PapersSection
                papers={filteredPapers}
                loading={loading}
                isBookmarked={isBookmarked}
                toggleBookmark={toggleBookmark}
                selectedTopics={prefs.selectedTopics}
              />
            </TabsContent>

            <TabsContent value="news" className="outline-none">
              <NewsSection
                news={filteredNews}
                loading={loading}
                isBookmarked={isBookmarked}
                toggleBookmark={toggleBookmark}
                selectedTopics={prefs.selectedTopics}
              />
            </TabsContent>

            <TabsContent value="videos" className="outline-none">
              <VideosSection
                videos={filteredVideos}
                loading={loading}
                isBookmarked={isBookmarked}
                toggleBookmark={toggleBookmark}
                selectedTopics={prefs.selectedTopics}
              />
            </TabsContent>

            <TabsContent value="github" className="outline-none">
              <GithubSection
                repos={filteredGithub}
                loading={loading}
                isBookmarked={isBookmarked}
                toggleBookmark={toggleBookmark}
                selectedTopics={prefs.selectedTopics}
              />
            </TabsContent>

            <TabsContent value="newsletters" className="outline-none">
              <NewslettersSection
                newsletters={filteredNewsletters}
                loading={loading}
                isBookmarked={isBookmarked}
                toggleBookmark={toggleBookmark}
                selectedTopics={prefs.selectedTopics}
              />
            </TabsContent>

            <TabsContent value="benchmarks" className="outline-none">
              <BenchmarksSection
                benchmarks={benchmarks}
                loading={loading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="border-t mt-12 py-6 bg-muted/20">
        <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <p>© {new Date().getFullYear()} AI Newspaper. Generated daily via GitHub Actions.</p>
          <p>Powered by OpenRouter ({digest?.model || 'nvidia/nemotron-3-ultra-550b-a55b:free'})</p>
        </div>
      </footer>
    </div>
  );
}
