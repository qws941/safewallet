"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Card, Badge, Skeleton } from "@safetywallet/ui";
import { useMember } from "@/hooks/use-api";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params?.id as string;
  const { data: member, isLoading } = useMember(memberId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center">
        <p>회원을 찾을 수 없습니다</p>
        <Button variant="link" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">회원 상세</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">기본 정보</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">이름</dt>
              <dd className="font-medium">{member.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">상태</dt>
              <dd>
                <Badge
                  variant={member.status === "ACTIVE" ? "default" : "secondary"}
                >
                  {member.status === "ACTIVE" ? "활성" : member.status}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">역할</dt>
              <dd className="font-medium">{member.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">가입일</dt>
              <dd className="font-medium">
                {new Date(member.joinedAt).toLocaleDateString("ko-KR")}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">추가 정보</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">회원 ID</dt>
              <dd className="font-medium text-sm">{member.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">사용자 ID</dt>
              <dd className="font-medium text-sm">{member.user.id}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
