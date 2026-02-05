'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@safetywallet/ui';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle, User } from 'lucide-react';

interface Candidate {
  id: string;
  user: {
    id: string;
    name: string | null;
    nameMasked: string | null;
    companyName: string | null;
    tradeType: string | null;
  };
  voteCount: number;
}

interface VotingData {
  month: string;
  hasVoted: boolean;
  votedCandidateId: string | null;
  candidates: Candidate[];
}

export default function VotesPage() {
  const router = useRouter();
  const { currentSiteId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);

  const { data: votingData, isLoading, error } = useQuery<VotingData>({
    queryKey: ['votes', 'current', currentSiteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: VotingData }>(`/votes/current?siteId=${currentSiteId}`);
      return res.data;
    },
    enabled: !!currentSiteId,
  });

  const voteMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      await apiFetch('/votes', {
        method: 'POST',
        body: JSON.stringify({ siteId: currentSiteId, candidateId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes', 'current'] });
    },
  });

  const handleVote = () => {
    if (selectedCandidate) {
      voteMutation.mutate(selectedCandidate);
    }
  };

  if (!currentSiteId) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">현장을 먼저 선택해주세요.</p>
            <Button onClick={() => router.push('/join')} className="mt-4">
              현장 선택
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">투표 정보를 불러오는데 실패했습니다.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : '오류가 발생했습니다.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    return `${year}년 ${parseInt(m)}월`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              우수 근로자 투표
            </CardTitle>
            <CardDescription>
              {votingData?.month && formatMonth(votingData.month)} 우수 근로자를 선정해주세요
            </CardDescription>
          </CardHeader>
        </Card>

        {votingData?.hasVoted ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="font-medium text-green-700">투표 완료!</p>
              <p className="text-sm text-green-600 mt-1">
                이번 달 투표에 참여해주셔서 감사합니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {votingData?.candidates.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">등록된 후보가 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {votingData?.candidates.map((candidate) => (
                  <Card
                    key={candidate.id}
                    className={`cursor-pointer transition-all ${
                      selectedCandidate === candidate.user.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedCandidate(candidate.user.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="flex-grow">
                        <p className="font-medium">
                          {candidate.user.nameMasked || candidate.user.name || '익명'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {candidate.user.companyName && `${candidate.user.companyName}`}
                          {candidate.user.tradeType && ` · ${candidate.user.tradeType}`}
                        </p>
                      </div>
                      {selectedCandidate === candidate.user.id && (
                        <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {votingData?.candidates && votingData.candidates.length > 0 && (
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedCandidate || voteMutation.isPending}
                onClick={handleVote}
              >
                {voteMutation.isPending ? '투표 중...' : '투표하기'}
              </Button>
            )}

            {voteMutation.error && (
              <p className="text-sm text-destructive text-center">
                {voteMutation.error instanceof Error
                  ? voteMutation.error.message
                  : '투표에 실패했습니다.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
