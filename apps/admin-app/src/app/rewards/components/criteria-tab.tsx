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
} from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { useAuthStore } from "@/stores/auth";
import {
  usePolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  type PointPolicy,
} from "@/hooks/use-points-api";

export function CriteriaTab() {
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
