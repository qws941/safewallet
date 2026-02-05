'use client';

import { FileText, Users, Coins, Clock } from 'lucide-react';
import { StatsCard } from '@/components/stats-card';
import { useDashboardStats } from '@/hooks/use-api';
import { Skeleton } from '@safetywallet/ui';

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="대기 중인 제보"
          value={stats?.pendingReviews ?? 0}
          icon={Clock}
          description="검토 필요"
        />
        <StatsCard
          title="이번 주 제보"
          value={stats?.postsThisWeek ?? 0}
          icon={FileText}
        />
        <StatsCard
          title="활성 회원"
          value={stats?.activeMembers ?? 0}
          icon={Users}
        />
        <StatsCard
          title="총 포인트"
          value={stats?.totalPoints?.toLocaleString() ?? 0}
          icon={Coins}
        />
      </div>
    </div>
  );
}
