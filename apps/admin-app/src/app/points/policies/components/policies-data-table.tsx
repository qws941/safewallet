"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button, Badge } from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import type { PointPolicy } from "@/hooks/use-api";

interface PoliciesDataTableProps {
  policies: PointPolicy[];
  onEdit: (policy: PointPolicy) => void;
  onDelete: (id: string) => void;
}

export function PoliciesDataTable({
  policies,
  onEdit,
  onDelete,
}: PoliciesDataTableProps) {
  const columns: Column<PointPolicy>[] = [
    {
      key: "name",
      header: "정책명",
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground">{item.reasonCode}</div>
        </div>
      ),
    },
    {
      key: "defaultAmount",
      header: "기본 포인트",
      sortable: true,
      render: (item) => (
        <div className="font-mono">
          {item.defaultAmount.toLocaleString()} P
          {(item.minAmount || item.maxAmount) && (
            <div className="text-xs text-muted-foreground">
              {item.minAmount ?? 0} ~ {item.maxAmount ?? "∞"}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "limits",
      header: "한도 (일/월)",
      render: (item) => (
        <div className="text-sm">
          <div>일: {item.dailyLimit ? `${item.dailyLimit}회` : "-"}</div>
          <div>월: {item.monthlyLimit ? `${item.monthlyLimit}회` : "-"}</div>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "상태",
      sortable: true,
      render: (item) => (
        <Badge variant={item.isActive ? "default" : "secondary"}>
          {item.isActive ? "활성" : "비활성"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "관리",
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={policies}
      searchable
      searchPlaceholder="정책명 또는 코드로 검색..."
    />
  );
}
