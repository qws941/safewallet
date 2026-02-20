"use client";

import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import {
  useSyncErrors,
  useUpdateSyncErrorStatus,
  type SyncErrorItem,
  type SyncErrorStatus,
  type SyncType,
} from "@/hooks/use-sync-errors";

type StatusFilter = "ALL" | SyncErrorStatus;
type SyncTypeFilter = "ALL" | SyncType;

interface PendingAction {
  id: string;
  status: "RESOLVED" | "IGNORED";
}

function getStatusBadgeClass(status: SyncErrorStatus): string {
  if (status === "OPEN") {
    return "bg-red-100 text-red-700 hover:bg-red-100";
  }
  if (status === "RESOLVED") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }
  return "bg-slate-200 text-slate-700 hover:bg-slate-200";
}

export default function SyncErrorsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [syncTypeFilter, setSyncTypeFilter] = useState<SyncTypeFilter>("ALL");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const queryParams = useMemo(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      syncType: syncTypeFilter === "ALL" ? undefined : syncTypeFilter,
      limit: 100,
      offset: 0,
    }),
    [statusFilter, syncTypeFilter],
  );

  const { data, isLoading } = useSyncErrors(queryParams);
  const { mutate: updateStatus, isPending: isUpdating } =
    useUpdateSyncErrorStatus();

  const rows = data?.errors || [];
  const total = data?.total || 0;

  const handleConfirmStatusUpdate = () => {
    if (!pendingAction) {
      return;
    }

    updateStatus(
      { id: pendingAction.id, status: pendingAction.status },
      {
        onSuccess: () => {
          toast({ description: "상태가 업데이트되었습니다." });
          setPendingAction(null);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            description: `상태 업데이트 실패: ${err.message}`,
          });
          setPendingAction(null);
        },
      },
    );
  };

  const columns: Column<SyncErrorItem>[] = [
    {
      key: "createdAt",
      header: "발생 시각",
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleString(),
    },
    {
      key: "syncType",
      header: "동기화 유형",
      render: (item) => (
        <span className="font-mono text-xs">{item.syncType}</span>
      ),
    },
    {
      key: "errorCode",
      header: "에러 코드",
      render: (item) => (
        <span className="font-mono text-xs">{item.errorCode || "-"}</span>
      ),
    },
    {
      key: "errorMessage",
      header: "에러 메시지",
      render: (item) => (
        <div className="max-w-[420px] truncate" title={item.errorMessage}>
          {item.errorMessage}
        </div>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (item) => (
        <Badge className={getStatusBadgeClass(item.status)}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "siteId",
      header: "현장 ID",
      render: (item) => (
        <span className="font-mono text-xs">{item.siteId || "-"}</span>
      ),
    },
    {
      key: "retryCount",
      header: "재시도 횟수",
      sortable: true,
      render: (item) => String(item.retryCount),
    },
    {
      key: "actions",
      header: "조치",
      render: (item) =>
        item.status === "OPEN" ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setPendingAction({ id: item.id, status: "RESOLVED" });
              }}
              disabled={isUpdating}
            >
              RESOLVED
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setPendingAction({ id: item.id, status: "IGNORED" });
              }}
              disabled={isUpdating}
            >
              IGNORED
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAS 동기화 에러 관리</h1>
          <p className="text-sm text-muted-foreground">총 {total}건</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 상태</SelectItem>
              <SelectItem value="OPEN">OPEN</SelectItem>
              <SelectItem value="RESOLVED">RESOLVED</SelectItem>
              <SelectItem value="IGNORED">IGNORED</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={syncTypeFilter}
            onValueChange={(value) =>
              setSyncTypeFilter(value as SyncTypeFilter)
            }
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="동기화 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체 유형</SelectItem>
              <SelectItem value="FAS_ATTENDANCE">FAS_ATTENDANCE</SelectItem>
              <SelectItem value="FAS_WORKER">FAS_WORKER</SelectItem>
              <SelectItem value="ATTENDANCE_MANUAL">
                ATTENDANCE_MANUAL
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-500">로딩 중...</div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchable
          searchPlaceholder="에러 메시지 또는 코드 검색..."
          emptyMessage="동기화 에러가 없습니다."
        />
      )}

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 동기화 에러 상태를 {pendingAction?.status}(으)로
              변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusUpdate}
              disabled={isUpdating}
            >
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
