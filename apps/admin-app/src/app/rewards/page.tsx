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
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@safetywallet/ui";
import {
  Trophy,
  Download,
  Minus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DataTable, type Column } from "@/components/data-table";
import { useAuthStore } from "@/stores/auth";
import {
  useMonthlyRankings,
  usePointsHistory,
  useRevokePoints,
  type LeaderboardEntry,
  type PointsHistoryEntry,
} from "@/hooks/use-rewards";
import {
  usePolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  type PointPolicy,
} from "@/hooks/use-points-api";

type TabKey = "rankings" | "criteria" | "history" | "export";

const TABS: { key: TabKey; label: string }[] = [
  { key: "rankings", label: "월간 순위" },
  { key: "criteria", label: "포상 기준 설정" },
  { key: "history", label: "지급 내역" },
  { key: "export", label: "내보내기" },
];

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function RankingsTab() {
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

function CriteriaTab() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const { data: policies } = usePolicies(siteId ?? undefined);
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();

  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    reasonCode: "",
    name: "",
    defaultAmount: "",
    minAmount: "",
    maxAmount: "",
    dailyLimit: "",
    monthlyLimit: "",
  });

  const resetForm = useCallback(() => {
    setForm({
      reasonCode: "",
      name: "",
      defaultAmount: "",
      minAmount: "",
      maxAmount: "",
      dailyLimit: "",
      monthlyLimit: "",
    });
    setEditId(null);
    setShowCreate(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!siteId) return;

    if (editId) {
      updatePolicy.mutate(
        {
          id: editId,
          data: {
            name: form.name,
            defaultAmount: Number(form.defaultAmount) || 0,
            ...(form.minAmount ? { minAmount: Number(form.minAmount) } : {}),
            ...(form.maxAmount ? { maxAmount: Number(form.maxAmount) } : {}),
            ...(form.dailyLimit ? { dailyLimit: Number(form.dailyLimit) } : {}),
            ...(form.monthlyLimit
              ? { monthlyLimit: Number(form.monthlyLimit) }
              : {}),
          },
        },
        { onSuccess: () => resetForm() },
      );
    } else {
      createPolicy.mutate(
        {
          siteId,
          reasonCode: form.reasonCode,
          name: form.name,
          defaultAmount: Number(form.defaultAmount) || 0,
          ...(form.minAmount ? { minAmount: Number(form.minAmount) } : {}),
          ...(form.maxAmount ? { maxAmount: Number(form.maxAmount) } : {}),
          ...(form.dailyLimit ? { dailyLimit: Number(form.dailyLimit) } : {}),
          ...(form.monthlyLimit
            ? { monthlyLimit: Number(form.monthlyLimit) }
            : {}),
        },
        { onSuccess: () => resetForm() },
      );
    }
  }, [siteId, form, editId, updatePolicy, createPolicy, resetForm]);

  const handleEdit = useCallback((policy: PointPolicy) => {
    setEditId(policy.id);
    setForm({
      reasonCode: policy.reasonCode,
      name: policy.name,
      defaultAmount: String(policy.defaultAmount),
      minAmount: policy.minAmount ? String(policy.minAmount) : "",
      maxAmount: policy.maxAmount ? String(policy.maxAmount) : "",
      dailyLimit: policy.dailyLimit ? String(policy.dailyLimit) : "",
      monthlyLimit: policy.monthlyLimit ? String(policy.monthlyLimit) : "",
    });
    setShowCreate(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deletePolicy.mutate(id);
    },
    [deletePolicy],
  );

  const columns: Column<PointPolicy>[] = useMemo(
    () => [
      { key: "reasonCode", header: "사유코드" },
      { key: "name", header: "정책명" },
      {
        key: "defaultAmount",
        header: "기본 포인트",
        sortable: true,
        render: (row: PointPolicy) => (
          <span className="font-mono">{row.defaultAmount}P</span>
        ),
      },
      {
        key: "dailyLimit",
        header: "일일한도",
        render: (row: PointPolicy) =>
          row.dailyLimit ? `${row.dailyLimit}P` : "-",
      },
      {
        key: "monthlyLimit",
        header: "월간한도",
        render: (row: PointPolicy) =>
          row.monthlyLimit ? `${row.monthlyLimit}P` : "-",
      },
      {
        key: "isActive",
        header: "상태",
        render: (row: PointPolicy) => (
          <Badge variant={row.isActive ? "default" : "secondary"}>
            {row.isActive ? "활성" : "비활성"}
          </Badge>
        ),
      },
      {
        key: "id",
        header: "",
        render: (row: PointPolicy) => (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => handleEdit(row)}>
              수정
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => handleDelete(row.id)}
            >
              삭제
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>포상 기준 설정</CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + 기준 추가
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={policies ?? []}
          emptyMessage="포상 기준이 없습니다."
        />
      </CardContent>

      <Dialog open={showCreate} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId ? "포상 기준 수정" : "포상 기준 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-sm font-medium">사유코드</span>
                <Input
                  value={form.reasonCode}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, reasonCode: e.target.value }))
                  }
                  disabled={!!editId}
                  placeholder="예: SAFETY_REPORT"
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">정책명</span>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="예: 안전 제보 포인트"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="mb-1 block text-sm font-medium">
                  기본 포인트
                </span>
                <Input
                  type="number"
                  value={form.defaultAmount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, defaultAmount: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">최소</span>
                <Input
                  type="number"
                  value={form.minAmount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, minAmount: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">최대</span>
                <Input
                  type="number"
                  value={form.maxAmount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, maxAmount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="mb-1 block text-sm font-medium">
                  일일 한도
                </span>
                <Input
                  type="number"
                  value={form.dailyLimit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dailyLimit: e.target.value }))
                  }
                />
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">
                  월간 한도
                </span>
                <Input
                  type="number"
                  value={form.monthlyLimit}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, monthlyLimit: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={createPolicy.isPending || updatePolicy.isPending}
            >
              {editId ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HistoryTab() {
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

function ExportTab() {
  const siteId = useAuthStore((s) => s.currentSiteId);
  const [exportType, setExportType] = useState<"rankings" | "history">(
    "rankings",
  );
  const { data: rankings } = useMonthlyRankings(siteId ?? undefined);
  const { data: history } = usePointsHistory({
    siteId: siteId ?? undefined,
    limit: 1000,
    offset: 0,
  });

  const handleExport = useCallback(() => {
    let csv = "";
    if (exportType === "rankings") {
      csv = "순위,이름,포인트\n";
      for (const entry of rankings?.leaderboard ?? []) {
        csv += `${entry.rank},${entry.nameMasked},${entry.totalPoints}\n`;
      }
    } else {
      csv = "일시,회원,포인트,사유\n";
      for (const entry of history?.entries ?? []) {
        csv += `${formatDate(entry.createdAt)},${entry.member.user.nameMasked},${entry.amount},${entry.reason ?? ""}\n`;
      }
    }

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportType}-${getCurrentMonth()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportType, rankings, history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>내보내기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium">내보내기 유형</span>
          <Select
            value={exportType}
            onValueChange={(v) => setExportType(v as "rankings" | "history")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rankings">월간 순위</SelectItem>
              <SelectItem value="history">지급 내역</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          CSV 다운로드
        </Button>
      </CardContent>
    </Card>
  );
}

export default function RewardsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("rankings");

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">포상 관리</h1>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rankings" && <RankingsTab />}
      {activeTab === "criteria" && <CriteriaTab />}
      {activeTab === "history" && <HistoryTab />}
      {activeTab === "export" && <ExportTab />}
    </div>
  );
}
