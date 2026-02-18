'use client';

import { FileText, Users, Clock, AlertTriangle, BarChart3, Timer } from 'lucide-react';
import { StatsCard } from '@/components/stats-card';
import { useDashboardStats } from '@/hooks/use-api';
import { Skeleton, Card } from '@safetywallet/ui';

const CATEGORY_LABELS: Record<string, string> = {
  HAZARD: '위험요소',
  UNSAFE_BEHAVIOR: '불안전 행동',
  INCONVENIENCE: '불편사항',
  SUGGESTION: '개선 제안',
  BEST_PRACTICE: '모범 사례',
};

const CATEGORY_COLORS: Record<string, string> = {
  HAZARD: 'bg-red-500',
  UNSAFE_BEHAVIOR: 'bg-orange-500',
  INCONVENIENCE: 'bg-yellow-500',
  SUGGESTION: 'bg-blue-500',
  BEST_PRACTICE: 'bg-green-500',
};

function CategoryDistributionChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">카테고리 분포</h3>
        <p className="text-muted-foreground">데이터가 없습니다</p>
      </Card>
    );
  }

  const sortedCategories = Object.entries(data).sort(([, a], [, b]) => b - a);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">카테고리 분포</h3>
      <div className="space-y-3">
        {sortedCategories.map(([category, count]) => {
          const percentage = Math.round((count / total) * 100);
          return (
            <div key={category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[category] || category}</span>
                <span className="text-muted-foreground">
                  {count}건 ({percentage}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${CATEGORY_COLORS[category] || 'bg-gray-500'} transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={`dash-skel-${i}`} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {(stats?.pendingCount ?? 0) > 0 && (stats?.avgProcessingHours ?? 0) >= 48 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-medium text-red-800">48시간 이상 미처리 백로그가 있습니다</p>
            <p className="text-sm text-red-600">
              미처리 {stats?.pendingCount}건 · 평균 처리시간 {stats?.avgProcessingHours}시간
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="오늘 제보"
          value={stats?.todayPostsCount ?? 0}
          icon={FileText}
          description="금일 등록된 제보"
        />
        <StatsCard
          title="미처리 백로그"
          value={stats?.pendingCount ?? 0}
          icon={Clock}
          description="검토 대기 중"
        />
        <StatsCard
          title="긴급 제보"
          value={stats?.urgentCount ?? 0}
          icon={AlertTriangle}
          description="즉시 처리 필요"
        />
        <StatsCard
          title="평균 처리 시간"
          value={`${stats?.avgProcessingHours ?? 0}h`}
          icon={Timer}
          description="승인/반려까지"
        />
        <StatsCard
          title="전체 사용자"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          description="등록된 사용자 수"
        />
        <StatsCard
          title="전체 제보"
          value={stats?.totalPosts ?? 0}
          icon={FileText}
          description="누적 제보 수"
        />
        <StatsCard
          title="오늘 출근"
          value={stats?.activeUsersToday ?? 0}
          icon={Users}
          description="금일 출석 인원"
        />
        <StatsCard
          title="전체 현장"
          value={stats?.totalSites ?? 0}
          icon={BarChart3}
          description="등록된 현장 수"
        />
      </div>

      <CategoryDistributionChart data={stats?.categoryDistribution ?? {}} />
    </div>
  );
}
