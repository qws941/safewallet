"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@safetywallet/ui";
import { Wifi, WifiOff, Clock, Users, AlertTriangle } from "lucide-react";
import type { FasSyncStatusResponse } from "@/hooks/use-fas-sync";
import { formatKstDateTime, formatRelativeTime } from "../sync-helpers";

interface StatusCardsProps {
  syncStatus: FasSyncStatusResponse;
  isHealthy: boolean;
}

function formatFasStatus(rawStatus: string | null): string {
  if (!rawStatus || rawStatus.trim() === "") {
    return "Hyperdrive 연결 정상";
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === "down" || normalized === "1") {
    return "연동 장애 감지";
  }
  if (
    normalized === "up" ||
    normalized === "ok" ||
    normalized === "healthy" ||
    normalized === "0"
  ) {
    return "연동 정상";
  }

  return `상태 코드: ${rawStatus}`;
}

export function StatusCards({ syncStatus, isHealthy }: StatusCardsProps) {
  return (
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
            {formatFasStatus(syncStatus.fasStatus)}
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
            {formatRelativeTime(syncStatus.lastFullSync ?? null)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {syncStatus.lastFullSync
              ? formatKstDateTime(syncStatus.lastFullSync)
              : "동기화 기록 없음"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">FAS 연동 사용자</CardTitle>
          <Users className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {syncStatus.userStats.fasLinked.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              / {syncStatus.userStats.total.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            미등록 전화번호 {syncStatus.userStats.missingPhone}건
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">동기화 에러</CardTitle>
          <AlertTriangle
            className={`h-4 w-4 ${
              syncStatus.syncErrorCounts.open > 0
                ? "text-destructive"
                : "text-green-500"
            }`}
          />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {syncStatus.syncErrorCounts.open}
            <span className="text-sm font-normal text-muted-foreground ml-1">
              건 미해결
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            해결 {syncStatus.syncErrorCounts.resolved} / 무시{" "}
            {syncStatus.syncErrorCounts.ignored}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
