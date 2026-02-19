"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@safetywallet/ui";
import { AlertTriangle } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { useSyncErrors, type SyncErrorItem } from "@/hooks/use-sync-errors";
import { formatKstDateTime } from "../sync-helpers";

type ErrorRow = SyncErrorItem & { index: number };

const errorColumns: Column<ErrorRow>[] = [
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

export function SyncErrorsCard() {
  const { data: syncErrorsData, isLoading: syncErrorsLoading } = useSyncErrors({
    status: "OPEN",
    limit: 50,
  });

  const syncErrors = useMemo(
    () => syncErrorsData?.errors ?? [],
    [syncErrorsData?.errors],
  );

  const syncErrorsWithIndex = useMemo(
    () => syncErrors.map((err, i) => ({ ...err, index: i + 1 })),
    [syncErrors],
  );

  return (
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
  );
}
