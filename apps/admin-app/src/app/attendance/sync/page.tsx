"use client";

import { Skeleton } from "@safetywallet/ui";
import { Database } from "lucide-react";
import { useFasSyncStatus } from "@/hooks/use-fas-sync";
import { StatusCards } from "./components/status-cards";
import { ManualSyncCard } from "./components/manual-sync-card";
import { FasSearchCard } from "./components/fas-search-card";
import { SyncErrorsCard } from "./components/sync-errors-card";
import { SyncLogsCard } from "./components/sync-logs-card";

export default function AttendanceSyncPage() {
  const { data: syncStatus, isLoading } = useFasSyncStatus();

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

  const normalizedFasStatus = (syncStatus?.fasStatus ?? "")
    .trim()
    .toLowerCase();
  const isHealthy =
    normalizedFasStatus === "" ||
    normalizedFasStatus === "0" ||
    normalizedFasStatus === "up" ||
    normalizedFasStatus === "ok" ||
    normalizedFasStatus === "healthy";

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

      {syncStatus && (
        <StatusCards syncStatus={syncStatus} isHealthy={isHealthy} />
      )}
      <ManualSyncCard />
      <FasSearchCard />
      <SyncErrorsCard />
      <SyncLogsCard syncLogs={syncStatus?.recentSyncLogs ?? []} />
    </div>
  );
}
