"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePosts, usePoints } from "@/hooks/use-api";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { PointsCard } from "@/components/points-card";
import { RankingCard } from "@/components/ranking-card";
import { PostCard } from "@/components/post-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@safetywallet/ui";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { CheckCircle, XCircle, Award, Bell, ChevronRight } from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
}

interface AttendanceStatus {
  attended: boolean;
  checkinAt: string | null;
}

export default function HomePage() {
  const { currentSiteId } = useAuth();
  const { data: postsData, isLoading: postsLoading } = usePosts(
    currentSiteId || "",
  );
  const { data: pointsData, isLoading: pointsLoading } = usePoints(
    currentSiteId || "",
  );
  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useLeaderboard(currentSiteId || null);

  const { data: attendanceData, isLoading: attendanceLoading } =
    useQuery<AttendanceStatus>({
      queryKey: ["attendance", "today", currentSiteId],
      queryFn: async () => {
        const res = await apiFetch<{ data: AttendanceStatus }>(
          `/attendance/today?siteId=${currentSiteId}`,
        );
        return res.data;
      },
      enabled: !!currentSiteId,
    });

  const recentPosts = postsData?.data?.slice(0, 3) || [];
  const pointsBalance = pointsData?.data?.balance || 0;
  const lastMonthBalance = (pointsData?.data as Record<string, unknown>)
    ?.lastMonthBalance as number | undefined;
  const pointsDelta =
    lastMonthBalance != null ? pointsBalance - lastMonthBalance : null;
  const myRank = leaderboardData?.myRank || null;
  const totalParticipants = leaderboardData?.leaderboard?.length || 0;

  const { data: announcementsData } = useQuery<AnnouncementItem[]>({
    queryKey: ["announcements", "recent", currentSiteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: AnnouncementItem[] }>(
        `/announcements?siteId=${currentSiteId}&limit=3`,
      );
      return res.data || [];
    },
    enabled: !!currentSiteId,
  });
  const recentAnnouncements = announcementsData || [];

  const formatCheckinTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        {attendanceLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : attendanceData?.attended ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-700">출근 완료</p>
                <p className="text-sm text-green-600">
                  {formatCheckinTime(attendanceData.checkinAt)} 체크인
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700">미출근</p>
                <p className="text-sm text-amber-600">
                  안면인식으로 출근 체크인 해주세요
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 h-32">
          {pointsLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <PointsCard
              balance={pointsBalance}
              delta={pointsDelta ?? undefined}
            />
          )}

          <RankingCard
            myRank={myRank}
            totalParticipants={totalParticipants}
            isLoading={leaderboardLoading}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Link href="/posts/new">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-1">📢</div>
                <div className="text-sm font-medium">안전제보</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/announcements">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-1">📣</div>
                <div className="text-sm font-medium">공지사항</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/votes">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <Award className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
                <div className="text-sm font-medium">우수근로자</div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">최근 내 제보</CardTitle>
              <Link href="/posts" className="text-sm text-primary">
                전체보기
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : recentPosts.length > 0 ? (
              <div>
                {recentPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                아직 제보한 내역이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
