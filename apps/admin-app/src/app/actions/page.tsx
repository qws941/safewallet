"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Skeleton } from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { useActionItems } from "@/hooks/use-api";
import { AlertTriangle, Clock, CheckCircle, ExternalLink } from "lucide-react";

interface ActionItem {
  id: string;
  postId: string;
  description: string;
  status: string;
  assignee?: { nameMasked: string };
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  NONE: "없음",
  ASSIGNED: "배정됨",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  VERIFIED: "확인됨",
  OVERDUE: "기한초과",
};

const statusColors: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success"
> = {
  NONE: "outline",
  ASSIGNED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  VERIFIED: "success", // Will need to check if 'success' variant exists or use 'default' with custom class
  OVERDUE: "destructive",
};

type FilterStatus =
  | ""
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "OVERDUE";

const filterTabs: { label: string; value: FilterStatus }[] = [
  { label: "전체", value: "" },
  { label: "배정됨", value: "ASSIGNED" },
  { label: "진행 중", value: "IN_PROGRESS" },
  { label: "완료", value: "COMPLETED" },
  { label: "확인됨", value: "VERIFIED" },
  { label: "기한초과", value: "OVERDUE" },
];

function isOverdue(item: ActionItem): boolean {
  if (
    item.status === "COMPLETED" ||
    item.status === "VERIFIED" ||
    item.status === "NONE"
  )
    return false;
  if (item.status === "OVERDUE") return true;
  if (!item.dueDate) return false;
  return new Date(item.dueDate) < new Date();
}

function getDaysUntilDue(dueDate: string): number {
  const diff = new Date(dueDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ActionsPage() {
  const { data: actions = [], isLoading } = useActionItems();
  const [filter, setFilter] = useState<FilterStatus>("");

  const allActions = actions as ActionItem[];
  const filteredActions = filter
    ? allActions.filter((a) => a.status === filter)
    : allActions;

  const overdueCount = allActions.filter(isOverdue).length;
  const inProgressCount = allActions.filter(
    (a) => a.status === "IN_PROGRESS",
  ).length;
  const completedCount = allActions.filter(
    (a) => a.status === "COMPLETED",
  ).length;
  const verifiedCount = allActions.filter(
    (a) => a.status === "VERIFIED",
  ).length;

  const columns: Column<ActionItem>[] = [
    {
      key: "description",
      header: "내용",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          {isOverdue(item) && (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          <span className={isOverdue(item) ? "text-red-700 font-medium" : ""}>
            {item.description || "(내용 없음)"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (item) => (
        <Badge
          variant={
            isOverdue(item)
              ? "destructive"
              : statusColors[item.status] || "default"
          }
          className={
            item.status === "VERIFIED"
              ? "bg-green-100 text-green-800 hover:bg-green-200 border-transparent"
              : ""
          }
        >
          {isOverdue(item)
            ? "기한초과"
            : statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: "assignee.nameMasked",
      header: "담당자",
      render: (item) => item.assignee?.nameMasked || "-",
    },
    {
      key: "dueDate",
      header: "기한",
      sortable: true,
      render: (item) => {
        if (!item.dueDate) return "-";
        const days = getDaysUntilDue(item.dueDate);
        const dateStr = new Date(item.dueDate).toLocaleDateString("ko-KR");
        if (
          item.status === "COMPLETED" ||
          item.status === "VERIFIED" ||
          item.status === "NONE"
        )
          return dateStr;
        if (days < 0)
          return (
            <span className="text-red-600 font-medium">
              {dateStr} ({Math.abs(days)}일 초과)
            </span>
          );
        if (days <= 3)
          return (
            <span className="text-amber-600">
              {dateStr} ({days}일 남음)
            </span>
          );
        return dateStr;
      },
    },
    {
      key: "postId",
      header: "게시물",
      render: (item) => (
        <Link
          href={`/posts/${item.postId}`}
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          보기 <ExternalLink className="h-3 w-3" />
        </Link>
      ),
    },
    {
      key: "createdAt",
      header: "생성일",
      sortable: true,
      render: (item) => new Date(item.createdAt).toLocaleDateString("ko-KR"),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">조치 현황</h1>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`stat-${i}`} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">조치 현황</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">기한 초과</p>
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2">
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">진행 중</p>
            <p className="text-2xl font-bold">{inProgressCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">완료</p>
            <p className="text-2xl font-bold text-green-600">
              {completedCount}
            </p>
          </div>
        </Card>
      </div>

      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>{overdueCount}건</strong>의 시정조치가 기한을 초과했습니다.
            즉시 확인해 주세요.
          </p>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {filterTabs.map((tab) => (
          <Button
            key={tab.value || "all"}
            type="button"
            variant={filter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
            {tab.value === "" && ` (${allActions.length})`}
            {tab.value === "ASSIGNED" &&
              ` (${allActions.filter((a) => a.status === "ASSIGNED").length})`}
            {tab.value === "IN_PROGRESS" && ` (${inProgressCount})`}
            {tab.value === "COMPLETED" && ` (${completedCount})`}
            {tab.value === "VERIFIED" && ` (${verifiedCount})`}
            {tab.value === "OVERDUE" &&
              ` (${allActions.filter((a) => a.status === "OVERDUE").length})`}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredActions}
        searchable
        searchPlaceholder="내용, 담당자 검색..."
        emptyMessage="조치 항목이 없습니다"
      />
    </div>
  );
}
