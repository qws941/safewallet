"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMyActions } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent, Badge, Skeleton, Button } from "@safetywallet/ui";
import { ActionStatus, ActionPriority } from "@safetywallet/types";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const statusFilters: Array<{ label: string; value: string | null }> = [
  { label: "전체", value: null },
  { label: "배정됨", value: ActionStatus.ASSIGNED },
  { label: "진행중", value: ActionStatus.IN_PROGRESS },
  { label: "완료", value: ActionStatus.COMPLETED },
  { label: "확인됨", value: ActionStatus.VERIFIED },
  { label: "기한초과", value: ActionStatus.OVERDUE },
];

const statusColors: Record<string, string> = {
  [ActionStatus.ASSIGNED]: "bg-blue-100 text-blue-800",
  [ActionStatus.IN_PROGRESS]: "bg-amber-100 text-amber-800",
  [ActionStatus.COMPLETED]: "bg-green-100 text-green-800",
  [ActionStatus.VERIFIED]: "bg-emerald-100 text-emerald-800",
  [ActionStatus.OVERDUE]: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  [ActionStatus.ASSIGNED]: "배정됨",
  [ActionStatus.IN_PROGRESS]: "진행중",
  [ActionStatus.COMPLETED]: "완료",
  [ActionStatus.VERIFIED]: "확인됨",
  [ActionStatus.OVERDUE]: "기한초과",
};

const priorityColors: Record<string, string> = {
  [ActionPriority.HIGH]: "bg-red-50 text-red-700",
  [ActionPriority.MEDIUM]: "bg-amber-50 text-amber-700",
  [ActionPriority.LOW]: "bg-gray-50 text-gray-600",
};

const priorityLabels: Record<string, string> = {
  [ActionPriority.HIGH]: "높음",
  [ActionPriority.MEDIUM]: "중간",
  [ActionPriority.LOW]: "낮음",
};

export default function ActionsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data, isLoading } = useMyActions({
    status: activeFilter || undefined,
  });

  const actions = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">내 시정조치 목록</h2>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {statusFilters.map((filter) => (
            <button
              type="button"
              key={filter.value ?? "all"}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground border",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : actions.length > 0 ? (
          <div className="space-y-3">
            {actions.map((action) => {
              const isOverdue =
                action.dueDate &&
                new Date(action.dueDate) < new Date() &&
                action.actionStatus !== ActionStatus.COMPLETED &&
                action.actionStatus !== ActionStatus.VERIFIED;

              return (
                <Card
                  key={action.id}
                  className="active:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/actions/view?id=${action.id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge
                          className={cn(
                            "font-medium",
                            statusColors[action.actionStatus] ||
                              "bg-gray-100 text-gray-800",
                          )}
                        >
                          {statusLabels[action.actionStatus] ||
                            action.actionStatus}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            priorityColors[action.priority] ||
                              "bg-gray-50 text-gray-600",
                          )}
                        >
                          {priorityLabels[action.priority] || action.priority}
                        </Badge>
                      </div>
                      {action.dueDate && (
                        <div
                          className={cn(
                            "flex items-center text-xs gap-1",
                            isOverdue
                              ? "text-red-600 font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          <Calendar className="w-3 h-3" />
                          {new Date(action.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <p className="font-medium line-clamp-2">
                      {action.description || "내용 없음"}
                    </p>

                    {action.post && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        관련 제보: {action.post.title || "제목 없음"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">✅</p>
            <p>할당된 시정조치가 없습니다.</p>
            <p className="text-sm mt-2">안전한 하루 되세요!</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
