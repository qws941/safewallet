"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { useMembers } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth";

interface Member {
  id: string;
  user: { id: string; name: string };
  status: string;
  role: string;
  joinedAt: string;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  SUSPENDED: "정지",
};

export default function MembersPage() {
  const router = useRouter();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const { data: members = [], isLoading } = useMembers();

  const columns: Column<Member>[] = [
    {
      key: "user.name",
      header: "이름",
      sortable: true,
      render: (item) => item.user.name || "-",
    },
    {
      key: "role",
      header: "역할",
      render: (item) => item.role,
    },
    {
      key: "status",
      header: "상태",
      render: (item) => (
        <Badge variant={item.status === "ACTIVE" ? "default" : "secondary"}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: "joinedAt",
      header: "가입일",
      sortable: true,
      render: (item) => new Date(item.joinedAt).toLocaleDateString("ko-KR"),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">회원 관리</h1>

      <DataTable
        columns={columns}
        data={members as Member[]}
        searchable
        searchPlaceholder="이름 검색..."
        onRowClick={(item) => router.push(`/members/${item.id}`)}
        emptyMessage={
          !hasHydrated || !currentSiteId
            ? "현장 정보를 준비하는 중입니다..."
            : isLoading
              ? "로딩 중..."
              : "회원이 없습니다"
        }
      />
    </div>
  );
}
