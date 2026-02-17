"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
} from "@safetywallet/ui";
import {
  Database,
  Wifi,
  WifiOff,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { useFasSyncStatus, type FasSyncLogEntry } from "@/hooks/use-fas-sync";
import { useSyncErrors, type SyncErrorItem } from "@/hooks/use-sync-errors";

export const runtime = "edge";

function formatKstDateTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  } catch {
    return dateStr;
  }
}

const ACTION_LABELS: Record<string, string> = {
  FAS_SYNC_COMPLETED: "동기화 완료",
  FAS_SYNC_FAILED: "동기화 실패",
  FAS_WORKERS_SYNCED: "수동 동기화",
};

const ACTION_BADGES: Record<string, "default" | "destructive" | "secondary"> = {
  FAS_SYNC_COMPLETED: "default",
  FAS_SYNC_FAILED: "destructive",
  FAS_WORKERS_SYNCED: "secondary",
};

export default function AttendanceSyncPage() {
  const { data: syncStatus, isLoading } = useFasSyncStatus();
  const { data: syncErrorsData, isLoading: syncErrorsLoading } = useSyncErrors({
    status: "OPEN",
    limit: 50,
  });

  const isHealthy = syncStatus?.fasStatus !== "down";

  const syncLogs = syncStatus?.recentSyncLogs ?? [];
  const syncErrors = syncErrorsData?.errors ?? [];

  const syncLogsWithIndex = useMemo(
    () => syncLogs.map((log, i) => ({ ...log, index: i + 1 })),
    [syncLogs],
  );

  const syncErrorsWithIndex = useMemo(
    () => syncErrors.map((err, i) => ({ ...err, index: i + 1 })),
    [syncErrors],
  );

  const logColumns: Column<(typeof syncLogsWithIndex)[0]>[] = [
    {
      key: "index",
      header: "No",
      render: (item) => (
        <span className="text-muted-foreground">{item.index}</span>
      ),
      className: "w-[60px]",
    },
    {
      key: "action",
      header: "유형",
      sortable: true,
      render: (item) => (
        <Badge variant={ACTION_BADGES[item.action] ?? "outline"}>
          {ACTION_LABELS[item.action] ?? item.action}
        </Badge>
      ),
    },
    {
      key: "reason",
      header: "상세",
      render: (item) => <span className="text-sm">{item.reason ?? "-"}</span>,
    },
    {
      key: "createdAt",
      header: "시각",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatKstDateTime(item.createdAt)}
        </span>
      ),
    },
  ];

  const errorColumns: Column<(typeof syncErrorsWithIndex)[0]>[] = [
    {
      key: "index",
      header: "No",
      render: (item) => (
        <span className="text-muted-foreground">{item.index}</span>
      ),
      className: "w-[60px]",
    },
    {
      key: "syncType",
      header: "유형",
      sortable: true,
      render: (item) => (
        <Badge variant="outline" className="text-xs">
          {item.syncType}
        </Badge>
      ),
    },
    {
      key: "errorCode",
      header: "에러코드",
      render: (item) => (
        <span className="font-mono text-xs">{item.errorCode ?? "-"}</span>
      ),
    },
    {
      key: "errorMessage",
      header: "메시지",
      render: (item) => (
        <span className="text-sm truncate max-w-[300px] block">
          {item.errorMessage}
        </span>
      ),
    },
    {
      key: "retryCount",
      header: "재시도",
      render: (item) => <span className="text-sm">{item.retryCount}회</span>,
    },
    {
      key: "createdAt",
      header: "발생시각",
      sortable: true,
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {formatKstDateTime(item.createdAt)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">FAS 연동 현황</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" />
          FAS 연동 현황
        </h1>
        <p className="text-muted-foreground mt-1">
          FAS 출근데이터 동기화 상태 및 에러 모니터링
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">FAS 연결상태</CardTitle>
            {isHealthy ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={isHealthy ? "default" : "destructive"}>
                {isHealthy ? "정상" : "연결 실패"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {syncStatus?.fasStatus
                ? `상태: ${syncStatus.fasStatus}`
                : "Hyperdrive 연결 정상"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              마지막 전체동기화
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRelativeTime(syncStatus?.lastFullSync ?? null)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {syncStatus?.lastFullSync
                ? formatKstDateTime(syncStatus.lastFullSync)
                : "동기화 기록 없음"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              FAS 연동 사용자
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.userStats.fasLinked.toLocaleString() ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {syncStatus?.userStats.total.toLocaleString() ?? 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              미등록 전화번호 {syncStatus?.userStats.missingPhone ?? 0}건
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">동기화 에러</CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                (syncStatus?.syncErrorCounts.open ?? 0) > 0
                  ? "text-destructive"
                  : "text-green-500"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncStatus?.syncErrorCounts.open ?? 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                건 미해결
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              해결 {syncStatus?.syncErrorCounts.resolved ?? 0} / 무시{" "}
              {syncStatus?.syncErrorCounts.ignored ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            미해결 동기화 에러
          </CardTitle>
          <CardDescription>OPEN 상태의 동기화 에러 목록</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={errorColumns}
            data={syncErrorsWithIndex}
            searchable
            searchPlaceholder="에러 메시지 검색..."
            emptyMessage={
              syncErrorsLoading ? "로딩 중..." : "미해결 에러가 없습니다."
            }
            pageSize={10}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            최근 동기화 로그
          </CardTitle>
          <CardDescription>최근 20건의 FAS 동기화 작업 기록</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={logColumns}
            data={syncLogsWithIndex}
            searchable
            searchPlaceholder="로그 검색..."
            emptyMessage="동기화 로그가 없습니다."
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
