"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@safetywallet/ui";
import { DataTable, type Column } from "@/components/data-table";
import { useMembers } from "@/hooks/use-api";

interface Member {
  id: string;
  user: { nameMasked: string; phone: string };
  status: string;
  role: string;
  pointsBalance: number;
  joinedAt: string;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
  SUSPENDED: "정지",
};

export default function MembersPage() {
  const router = useRouter();
  const { data: members = [], isLoading } = useMembers();

  const columns: Column<Member>[] = [
    { key: "user.nameMasked", header: "이름", sortable: true },
    { key: "user.phone", header: "전화번호" },
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
      key: "pointsBalance",
      header: "포인트",
      sortable: true,
      render: (item) => item.pointsBalance.toLocaleString(),
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
        searchPlaceholder="이름, 전화번호 검색..."
        onRowClick={(item) => router.push(`/members/${item.id}`)}
        emptyMessage={isLoading ? "로딩 중..." : "회원이 없습니다"}
      />
    </div>
  );
}
