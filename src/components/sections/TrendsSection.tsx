import { useMemo } from 'react';
import type { TopicCluster } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, BarChart2, ArrowUpRight, ArrowRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

interface Props {
  topicClusters: TopicCluster[];
  loading: boolean;
  selectedTopics: string[];
  onToggleTopic: (topic: string) => void;
}

export function TrendsSection({ topicClusters, loading, selectedTopics, onToggleTopic }: Props) {
  const chartData = useMemo(() => {
    return [...topicClusters]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map((c) => ({
        name: c.topic,
        frequency: c.frequency,
        growth: c.growth,
      }));
  }, [topicClusters]);

  const sortedClusters = useMemo(() => {
    return [...topicClusters].sort((a, b) => {
      // Prioritize rising growth, then frequency
      if (a.growth === 'rising' && b.growth !== 'rising') return -1;
      if (a.growth !== 'rising' && b.growth === 'rising') return 1;
      return b.frequency - a.frequency;
    });
  }, [topicClusters]);

  if (loading) {
    return (
      <section id="trends" className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (!topicClusters.length) {
    return (
      <section id="trends" className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-violet-500" />
          <h2 className="text-2xl font-bold tracking-tight">Topic Trends</h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No trend data available yet. Run the pipeline to populate topic clusters.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section id="trends" className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-violet-500" />
        <h2 className="text-2xl font-bold tracking-tight">Topic Trends</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Chart Card */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground" />
              Top 10 Topics by Mentions
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
              >
                <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(9, 9, 11, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="frequency" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => {
                    const color =
                      entry.growth === 'rising'
                        ? '#10B981' // emerald
                        : entry.growth === 'declining'
                        ? '#EF4444' // red
                        : '#3B82F6'; // blue
                    return <Cell key={`cell-${index}`} fill={color} opacity={0.85} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Growth Clusters Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Active AI Hubs</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto pr-1">
            <div className="space-y-2">
              {sortedClusters.map((c) => {
                const isSelected = selectedTopics.includes(c.topic);
                const isRising = c.growth === 'rising';
                const isDeclining = c.growth === 'declining';

                return (
                  <button
                    key={c.topic}
                    onClick={() => onToggleTopic(c.topic)}
                    className={`flex w-full items-center justify-between rounded-lg border p-2 text-left text-xs transition-all hover:bg-muted ${
                      isSelected ? 'border-primary bg-primary/5' : 'bg-card'
                    }`}
                  >
                    <div className="font-medium">{c.topic}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono">{c.frequency} mentions</span>
                      {isRising ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-0 flex items-center gap-0.5 px-1 py-0">
                          <ArrowUpRight className="h-3 w-3" />
                          Rising
                        </Badge>
                      ) : isDeclining ? (
                        <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/10 border-0 flex items-center gap-0.5 px-1 py-0">
                          <ArrowDownRight className="h-3 w-3" />
                          Down
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 border-0 flex items-center gap-0.5 px-1 py-0">
                          <ArrowRight className="h-3 w-3" />
                          Stable
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
