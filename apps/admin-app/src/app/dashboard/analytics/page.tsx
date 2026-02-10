"use client";

import { useStats } from "@/hooks/use-stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@safetywallet/ui";
import {
  BarChart3,
  Users,
  MapPin,
  FileText,
  Activity,
  Clock,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  HAZARD: "위험 요소",
  UNSAFE_BEHAVIOR: "불안전 행동",
  INCONVENIENCE: "불편 사항",
  SUGGESTION: "개선 제안",
  BEST_PRACTICE: "우수 사례",
};

export default function AnalyticsPage() {
  const { data, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          대시보드 분석
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    {
      label: "전체 사용자",
      value: data.totalUsers,
      suffix: "명",
      icon: Users,
      color: "text-blue-500",
    },
    {
      label: "전체 현장",
      value: data.totalSites,
      suffix: "개",
      icon: MapPin,
      color: "text-green-500",
    },
    {
      label: "전체 게시물",
      value: data.totalPosts,
      suffix: "건",
      icon: FileText,
      color: "text-purple-500",
    },
    {
      label: "오늘 활성 사용자",
      value: data.activeUsersToday,
      suffix: "명",
      icon: Activity,
      color: "text-orange-500",
    },
    {
      label: "오늘 게시물",
      value: data.todayPostsCount,
      suffix: "건",
      icon: FileText,
      color: "text-cyan-500",
    },
    {
      label: "대기 중",
      value: data.pendingCount,
      suffix: "건",
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      label: "긴급 건수",
      value: data.urgentCount,
      suffix: "건",
      icon: AlertTriangle,
      color: "text-red-500",
    },
    {
      label: "평균 처리 시간",
      value: data.avgProcessingHours,
      suffix: "시간",
      icon: AlertCircle,
      color: "text-indigo-500",
    },
  ];

  const categoryEntries = Object.entries(data.categoryDistribution || {});
  const maxCount = Math.max(...categoryEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          대시보드 분석
        </h1>
        <p className="text-muted-foreground mt-1">
          현장 안전 보고 현황을 한눈에 확인합니다
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                  <span className="text-3xl font-bold">
                    {typeof stat.value === "number"
                      ? Number.isInteger(stat.value)
                        ? stat.value.toLocaleString()
                        : stat.value.toFixed(1)
                      : stat.value}
                  </span>
                  <span className="text-muted-foreground">{stat.suffix}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categoryEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 게시물 분포</CardTitle>
            <CardDescription>
              전체 기간 기준 카테고리별 신고 건수
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryEntries
                .sort(([, a], [, b]) => b - a)
                .map(([cat, cnt]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm w-28 shrink-0">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${(cnt / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {cnt.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
