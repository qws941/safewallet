"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@safetywallet/ui";
import { Trophy } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { useAuthStore } from "@/stores/auth";
import { useMonthlyRankings, type LeaderboardEntry } from "@/hooks/use-rewards";
import { getCurrentMonth } from "../rewards-helpers";

export function RankingsTab() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const { data, isLoading } = useMonthlyRankings(siteId ?? undefined);

  const columns: Column<LeaderboardEntry>[] = useMemo(
    () => [
      { key: "rank", header: "순위", sortable: true },
      { key: "nameMasked", header: "이름" },
      {
        key: "totalPoints",
        header: "포인트",
        sortable: true,
        render: (row: LeaderboardEntry) => (
          <span className="font-semibold text-blue-600">
            {row.totalPoints.toLocaleString()}P
          </span>
        ),
      },
      {
        key: "isCurrentUser",
        header: "",
        render: (row: LeaderboardEntry) =>
          row.isCurrentUser ? <Badge variant="secondary">나</Badge> : null,
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          월간 순위 ({getCurrentMonth()})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">로딩 중...</p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.leaderboard ?? []}
            emptyMessage="순위 데이터가 없습니다."
          />
        )}
      </CardContent>
    </Card>
  );
}
