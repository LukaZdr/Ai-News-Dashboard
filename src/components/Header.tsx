import { useState, useRef, useEffect } from 'react';
import type { ContentItem } from '@/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Bookmark, Sun, Moon, FileText, Newspaper, Video, GitBranch, X, RotateCcw } from 'lucide-react';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: ContentItem[];
  selectedTopics: string[];
  onToggleTopic: (topic: string) => void;
  onClearTopics: () => void;
  filterBookmarkedOnly: boolean;
  onToggleBookmarkedOnly: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onReload: () => void;
  isReloading: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  searchResults,
  selectedTopics,
  onToggleTopic,
  onClearTopics,
  filterBookmarkedOnly,
  onToggleBookmarkedOnly,
  darkMode,
  onToggleDarkMode,
  onReload,
  isReloading,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderIcon = (type: ContentItem['type']) => {
    switch (type) {
      case 'paper':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'news':
        return <Newspaper className="h-4 w-4 text-emerald-500" />;
      case 'video':
        return <Video className="h-4 w-4 text-red-500" />;
      case 'github':
        return <GitBranch className="h-4 w-4 text-indigo-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md support-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black tracking-tighter text-lg">
            AI
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">AI Newspaper</h1>
            <span className="text-[10px] text-muted-foreground">Daily Intelligence Feed</span>
          </div>
        </div>

        {/* Global Search and Tools */}
        <div className="flex flex-1 items-center justify-end gap-3 max-w-lg ml-auto">
          <div ref={dropdownRef} className="relative w-full max-w-xs md:max-w-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search everything..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-9 h-9 w-full rounded-full bg-muted/50 border-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    onSearchChange('');
                    setShowDropdown(false);
                  }}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Instant Search Dropdown */}
            {showDropdown && searchQuery && (
              <div className="absolute right-0 mt-1.5 w-80 md:w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg">
                <div className="p-2 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Search Results ({searchResults.length})
                </div>
                <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No matching items found.
                    </div>
                  ) : (
                    searchResults.map((item) => {
                      const id = item.data.id;
                      const title = 'title' in item.data ? item.data.title : item.data.fullName;
                      const url = item.data.url;
                      return (
                        <a
                          key={id}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2.5 rounded-md p-2 hover:bg-muted text-left transition-colors"
                        >
                          <div className="mt-0.5 shrink-0">{renderIcon(item.type)}</div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium line-clamp-1 leading-tight">{title}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">
                              {'authors' in item.data
                                ? item.data.authors.slice(0, 2).join(', ')
                                : 'description' in item.data
                                ? item.data.description
                                : ''}
                            </p>
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sync status / reload */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onReload}
            disabled={isReloading}
            className="h-9 w-9 rounded-full shrink-0"
            title="Reload Data"
          >
            <RotateCcw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Filter Bookmarked Only */}
          <Button
            variant={filterBookmarkedOnly ? 'default' : 'ghost'}
            size="icon"
            onClick={onToggleBookmarkedOnly}
            className="h-9 w-9 rounded-full shrink-0"
            title="Saved Items"
          >
            <Bookmark className={`h-4 w-4 ${filterBookmarkedOnly ? 'fill-current' : ''}`} />
          </Button>

          {/* Theme Selector */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDarkMode}
            className="h-9 w-9 rounded-full shrink-0"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Selected Filters Ribbon */}
      {selectedTopics.length > 0 && (
        <div className="bg-muted/40 border-t py-1.5">
          <div className="container mx-auto max-w-7xl px-4 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              Active Filters:
            </span>
            <div className="flex gap-1.5">
              {selectedTopics.map((topic) => (
                <Badge
                  key={topic}
                  variant="secondary"
                  className="text-[10px] flex items-center gap-1 cursor-pointer shrink-0"
                  onClick={() => onToggleTopic(topic)}
                >
                  {topic}
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </Badge>
              ))}
            </div>
            <Button
              variant="link"
              onClick={onClearTopics}
              className="text-[10px] h-auto p-0 text-muted-foreground hover:text-foreground ml-auto shrink-0"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
