'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@safetywallet/ui';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Award, Trophy, Medal } from 'lucide-react';

interface VoteResult {
  user: {
    id: string;
    name: string | null;
    nameMasked: string | null;
    companyName: string | null;
    tradeType: string | null;
  };
  voteCount: number;
}

interface VoteResults {
  month: string;
  results: VoteResult[];
}

export const runtime = 'edge';

export default function VotesPage() {
  const [siteId] = useState<string | null>(null);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: voteResults, isLoading } = useQuery<VoteResults>({
    queryKey: ['votes', 'results', siteId, selectedMonth],
    queryFn: async () => {
      const res = await apiFetch<{ data: VoteResults }>(`/votes/results?siteId=${siteId}&month=${selectedMonth}`);
      return res.data;
    },
    enabled: !!siteId,
  });

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    return `${year}년 ${parseInt(m)}월`;
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push(month);
    }
    return options;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="text-lg font-bold text-gray-400">{rank}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-yellow-500" />
          우수 근로자 투표
        </h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {getMonthOptions().map((month) => (
          <Button
            key={month}
            variant={selectedMonth === month ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMonth(month)}
          >
            {formatMonth(month)}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{formatMonth(selectedMonth)} 투표 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {!siteId ? (
            <p className="text-muted-foreground text-center py-8">현장을 선택해주세요.</p>
          ) : isLoading ? (
            <p className="text-center py-8">로딩 중...</p>
          ) : voteResults?.results && voteResults.results.length > 0 ? (
            <div className="space-y-3">
              {voteResults.results.map((result, index) => (
                <div
                  key={result.user.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center">
                      {getRankIcon(index + 1)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {result.user.nameMasked || result.user.name || '익명'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.user.companyName}
                        {result.user.tradeType && ` · ${result.user.tradeType}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{result.voteCount}</span>
                    <span className="text-sm text-muted-foreground ml-1">표</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">투표 결과가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
