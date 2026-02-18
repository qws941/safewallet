"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@safetywallet/ui";
import { Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { useAuthStore } from "@/stores/auth";
import {
  usePointsHistory,
  useRevokePoints,
  type PointsHistoryEntry,
} from "@/hooks/use-rewards";
import { formatDate } from "../rewards-helpers";

export function HistoryTab() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const [offset, setOffset] = useState(0);
  const pageSize = 20;
  const { data, isLoading } = usePointsHistory({
    siteId: siteId ?? undefined,
    limit: pageSize,
    offset,
  });

  const [revokeTarget, setRevokeTarget] = useState<PointsHistoryEntry | null>(
    null,
  );
  const [revokeReason, setRevokeReason] = useState("");
  const revokePoints = useRevokePoints();

  const handleRevoke = useCallback(() => {
    if (!revokeTarget || !siteId) return;
    revokePoints.mutate(
      {
        memberId: revokeTarget.id,
        amount: revokeTarget.amount,
        reason: revokeReason || "관리자 차감",
      },
      {
        onSuccess: () => {
          setRevokeTarget(null);
          setRevokeReason("");
        },
      },
    );
  }, [revokeTarget, siteId, revokeReason, revokePoints]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.floor(offset / pageSize) + 1;

  const columns: Column<PointsHistoryEntry>[] = useMemo(
    () => [
      {
        key: "createdAt",
        header: "일시",
        sortable: true,
        render: (row: PointsHistoryEntry) => formatDate(row.createdAt),
      },
      {
        key: "id",
        header: "회원",
        render: (row: PointsHistoryEntry) => row.member.user.nameMasked,
      },
      {
        key: "amount",
        header: "포인트",
        sortable: true,
        render: (row: PointsHistoryEntry) => (
          <span className={row.amount >= 0 ? "text-blue-600" : "text-red-600"}>
            {row.amount >= 0 ? "+" : ""}
            {row.amount}P
          </span>
        ),
      },
      {
        key: "reason",
        header: "사유",
      },
      {
        key: "amount",
        header: "",
        render: (row: PointsHistoryEntry) =>
          row.amount > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => setRevokeTarget(row)}
            >
              <Minus className="mr-1 h-3 w-3" />
              차감
            </Button>
          ) : null,
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>지급 내역</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">로딩 중...</p>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={data?.entries ?? []}
              emptyMessage="지급 내역이 없습니다."
              pageSize={pageSize}
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                총 {total.toLocaleString()}건
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offset + pageSize >= total}
                  onClick={() => setOffset(offset + pageSize)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>포인트 차감</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p>
              <strong>{revokeTarget?.member.user.nameMasked}</strong>님의{" "}
              <strong>{revokeTarget?.amount}P</strong>를 차감합니다.
            </p>
            <div>
              <span className="mb-1 block text-sm font-medium">차감 사유</span>
              <Input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="차감 사유를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revokePoints.isPending}
            >
              차감 확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
