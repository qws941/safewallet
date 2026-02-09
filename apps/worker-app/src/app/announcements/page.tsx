"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAnnouncements } from "@/hooks/use-api";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Badge,
} from "@safetywallet/ui";
import { apiFetch } from "@/lib/api";

type AnnouncementType =
  | "RANKING"
  | "BEST_PRACTICE"
  | "ACTION_COMPLETE"
  | "REWARD"
  | "GENERAL";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  type?: AnnouncementType;
  isRead?: boolean;
}

const TYPE_CONFIG: Record<
  AnnouncementType,
  { icon: string; label: string; color: string }
> = {
  RANKING: {
    icon: "🏆",
    label: "랭킹",
    color: "bg-yellow-100 text-yellow-800",
  },
  BEST_PRACTICE: {
    icon: "⭐",
    label: "우수사례",
    color: "bg-blue-100 text-blue-800",
  },
  ACTION_COMPLETE: {
    icon: "✅",
    label: "조치완료",
    color: "bg-green-100 text-green-800",
  },
  REWARD: { icon: "🎁", label: "포상", color: "bg-purple-100 text-purple-800" },
  GENERAL: { icon: "📣", label: "일반", color: "bg-gray-100 text-gray-800" },
};

export default function AnnouncementsPage() {
  const { currentSiteId } = useAuth();
  const { data, isLoading } = useAnnouncements(currentSiteId || "");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const announcements = (data?.data || []) as Announcement[];

  const handleExpand = async (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    if (!readIds.has(id)) {
      setReadIds((prev) => new Set(prev).add(id));
      try {
        await apiFetch(`/announcements/${id}/read`, { method: "POST" });
      } catch {
        // read tracking is best-effort
      }
    }
  };

  const unreadCount = announcements.filter(
    (a) => !a.isRead && !readIds.has(a.id),
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">공지사항</h2>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}개 새 공지
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((announcement) => {
              const type = announcement.type || "GENERAL";
              const config = TYPE_CONFIG[type];
              const isRead =
                announcement.isRead || readIds.has(announcement.id);
              const isExpanded = expandedId === announcement.id;

              return (
                <Card
                  key={announcement.id}
                  className={`cursor-pointer transition-colors ${
                    announcement.isPinned ? "border-primary" : ""
                  } ${!isRead ? "bg-white border-l-4 border-l-primary" : "bg-gray-50/50"}`}
                  onClick={() => handleExpand(announcement.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {announcement.isPinned && (
                        <span className="text-sm">📌</span>
                      )}
                      <span className="text-sm">{config.icon}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${config.color}`}
                      >
                        {config.label}
                      </Badge>
                      {!isRead && (
                        <span className="w-2 h-2 bg-primary rounded-full" />
                      )}
                    </div>
                    <CardTitle className="text-base mt-1">
                      {announcement.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(announcement.createdAt).toLocaleDateString(
                        "ko-KR",
                      )}
                    </p>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-4xl mb-4">📣</p>
            <p>공지사항이 없습니다.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
