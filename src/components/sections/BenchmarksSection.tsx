import { useState, useMemo } from 'react';
import type { ModelBenchmark } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Trophy,
  ExternalLink,
  Code,
  DollarSign,
  Cpu,
  Search,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  Scale,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ZAxis,
  Cell
} from 'recharts';

interface Props {
  benchmarks: ModelBenchmark[];
  loading: boolean;
}

const BENCHMARK_LINKS = [
  {
    name: "Artificial Analysis",
    description: "Overall rankings, speed benchmarks (latency/throughput), and quality-to-cost metrics.",
    url: "https://artificialanalysis.ai",
    badge: "Speed & API Metrics",
    icon: Cpu,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
  },
  {
    name: "Chatbot Arena",
    description: "LMSYS blind crowdsourced LLM battleground tracking human preference Elo ratings.",
    url: "https://chat.lmsys.org/?leaderboard",
    badge: "Human Preference Elo",
    icon: Trophy,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/20"
  },
  {
    name: "Papers with Code",
    description: "Scientific benchmark tracking, tracking State-of-the-Art (SOTA) research over time.",
    url: "https://paperswithcode.com/sota",
    badge: "Academic SOTA",
    icon: BookOpen,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/20"
  },
  {
    name: "Hugging Face Leaderboards",
    description: "Comprehensive automated evaluation suites for open-source foundation models.",
    url: "https://huggingface.co/spaces/open-llm-leaderboard/open-llm-leaderboard",
    badge: "Open weight evaluation",
    icon: Scale,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20"
  },
  {
    name: "OpenRouter",
    description: "Pricing comparison, active metadata endpoint speeds, and multi-provider server health.",
    url: "https://openrouter.ai/models",
    badge: "API Pricing & Meta",
    icon: DollarSign,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/20"
  }
];

type SortKey = 'arenaElo' | 'codingElo' | 'mmlu' | 'price' | 'agentSuccessRate';

export function BenchmarksSection({ benchmarks, loading }: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'open' | 'proprietary'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('arenaElo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const sortedAndFiltered = useMemo(() => {
    let result = [...benchmarks];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((m) => m.type === filterType);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.creator.toLowerCase().includes(q) ||
          m.strengths.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'price') {
        valA = a.inputPrice + a.outputPrice;
        valB = b.inputPrice + b.outputPrice;
      } else {
        valA = (a as any)[sortBy] ?? 0;
        valB = (b as any)[sortBy] ?? 0;
      }

      if (sortOrder === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });

    return result;
  }, [benchmarks, filterType, search, sortBy, sortOrder]);

  const topModels = useMemo(() => {
    if (benchmarks.length === 0) return null;
    const sortedByArena = [...benchmarks].sort((a, b) => b.arenaElo - a.arenaElo);
    const sortedByCoding = [...benchmarks].sort((a, b) => b.codingElo - a.codingElo);
    const sortedByCost = [...benchmarks].sort(
      (a, b) => (a.inputPrice + a.outputPrice) - (b.inputPrice + b.outputPrice)
    );

    return {
      topOverall: sortedByArena[0],
      topCoding: sortedByCoding[0],
      mostCostEfficient: sortedByCost[0],
    };
  }, [benchmarks]);

  const scatterData = useMemo(() => {
    return benchmarks.map((m) => ({
      name: m.name,
      creator: m.creator,
      x: m.inputPrice + m.outputPrice === 0 ? 0.01 : (m.inputPrice + m.outputPrice) / 2, // Average price
      y: m.arenaElo,
      z: m.codingElo,
      type: m.type,
    }));
  }, [benchmarks]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-24 w-1/3" />
          <Skeleton className="h-24 w-1/3" />
          <Skeleton className="h-24 w-1/3" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <section id="benchmarks" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Model Benchmarks
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            LMSYS Chatbot Arena standings, coding ELO, and pricing optimization.
          </p>
        </div>
      </div>

      {/* Highlights - SOTA Models at a Glance */}
      {topModels && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-indigo-200 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/30 to-transparent dark:from-indigo-950/15">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                Top Overall Model
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-bold truncate text-foreground">
                {topModels.topOverall.name}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>{topModels.topOverall.creator}</span>
                <span className="font-semibold text-foreground">Elo {topModels.topOverall.arenaElo}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-950/60 bg-gradient-to-br from-emerald-50/30 to-transparent dark:from-emerald-950/15">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                <Code className="h-3.5 w-3.5" />
                Best Coding Model
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-bold truncate text-foreground">
                {topModels.topCoding.name}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>{topModels.topCoding.creator}</span>
                <span className="font-semibold text-foreground">Elo {topModels.topCoding.codingElo}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-pink-200 dark:border-pink-950/60 bg-gradient-to-br from-pink-50/30 to-transparent dark:from-pink-950/15">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs text-pink-600 dark:text-pink-400 font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                <DollarSign className="h-3.5 w-3.5" />
                Best Value / MoE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-lg font-bold truncate text-foreground">
                {topModels.mostCostEfficient.name}
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>{topModels.mostCostEfficient.creator}</span>
                <span className="font-semibold text-foreground">
                  ${(topModels.mostCostEfficient.inputPrice).toFixed(2)}/1M tok
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Leaderboard & Interactive Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Columns - Interactive Standing Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border">
            <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Arena Leaderboard</CardTitle>
                <CardDescription className="text-xs">
                  Active model evaluation metrics sorted by capability.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'all'
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('proprietary')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'proprietary'
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    API
                  </button>
                  <button
                    onClick={() => setFilterType('open')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      filterType === 'open'
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Open
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search Control */}
              <div className="px-4 pb-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search model features or providers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 border-none bg-zinc-50 dark:bg-zinc-900/60 ring-0 focus-visible:ring-1"
                  />
                </div>
              </div>

              {/* Table view */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30 text-muted-foreground font-semibold">
                      <th className="p-3 pl-4">Model Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('arenaElo')}>
                        <span className="flex items-center gap-1">
                          Arena Elo <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('codingElo')}>
                        <span className="flex items-center gap-1">
                          Coding <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('mmlu')}>
                        <span className="flex items-center gap-1">
                          MMLU <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('agentSuccessRate')}>
                        <span className="flex items-center gap-1">
                          Agent % <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="p-3 cursor-pointer select-none" onClick={() => handleSort('price')}>
                        <span className="flex items-center gap-1">
                          Price/1M <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedAndFiltered.map((model) => {
                      const isTop1 = model.id === topModels?.topOverall.id;
                      return (
                        <tr
                          key={model.id}
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors group"
                        >
                          <td className="p-3 pl-4">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {isTop1 && <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                              <span>{model.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{model.creator}</span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 border-none capitalize ${
                                model.type === 'proprietary'
                                  ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              }`}
                            >
                              {model.type === 'proprietary' ? 'API' : 'Open'}
                            </Badge>
                          </td>
                          <td className="p-3 font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                            {model.arenaElo}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {model.codingElo}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {model.mmlu}%
                          </td>
                          <td className="p-3 font-mono text-foreground font-semibold">
                            {model.agentSuccessRate ? `${model.agentSuccessRate.toFixed(2)}%` : '-'}
                          </td>
                          <td className="p-3 font-mono text-foreground">
                            <div className="flex flex-col">
                              <span>${model.inputPrice.toFixed(2)} <span className="text-[9px] text-muted-foreground">in</span></span>
                              <span className="text-muted-foreground">${model.outputPrice.toFixed(2)} <span className="text-[8px]">out</span></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Cost vs Elo Pareto Curve */}
        <div className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Value Analysis</CardTitle>
              <CardDescription className="text-xs">
                Plotting Model Cost (Average Price/1M tokens) vs. Chatbot Arena Elo. Bottom-right represents ideal value.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] p-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Cost"
                    unit="$/1M"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    scale="log"
                    domain={[0.1, 15]}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Elo"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    domain={[1150, 1310]}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 140]} name="Coding Elo" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: 'rgba(9, 9, 11, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2 space-y-1">
                            <p className="font-bold text-indigo-400">{data.name}</p>
                            <p className="text-muted-foreground text-[10px]">{data.creator}</p>
                            <div className="border-t border-zinc-700/50 pt-1 mt-1 font-mono text-[10px] space-y-0.5">
                              <p>Avg Cost: ${data.x.toFixed(2)}/1M tokens</p>
                              <p>Arena Elo: <span className="text-amber-400 font-semibold">{data.y}</span></p>
                              <p>Coding Elo: {data.z}</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter name="LLM Models" data={scatterData}>
                    {scatterData.map((entry, index) => {
                      const color = entry.type === 'proprietary' ? '#8B5CF6' : '#10B981';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Benchmark Resource Directories */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            External Benchmark Directories
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Access deep evaluations, latency graphs, and state-of-the-art academic trackers.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENCHMARK_LINKS.map((link) => {
            const LinkIcon = link.icon;
            return (
              <Card
                key={link.name}
                className="group relative transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800"
              >
                <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] py-0 border-none ${link.color}`}>
                        {link.badge}
                      </Badge>
                      <LinkIcon className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                    </div>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm font-bold text-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 group/link cursor-pointer"
                    >
                      {link.name}
                      <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity" />
                    </a>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {link.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
