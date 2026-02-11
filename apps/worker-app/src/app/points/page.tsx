"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePoints } from "@/hooks/use-api";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { PointsCard } from "@/components/points-card";
import { Card, CardContent, Skeleton, Badge } from "@safetywallet/ui";
import { Trophy, Medal, Crown, Calendar, TrendingUp } from "lucide-react";

type RankingTab = "monthly" | "cumulative";

export default function PointsPage() {
  const { currentSiteId } = useAuth();
  const [rankingTab, setRankingTab] = useState<RankingTab>("cumulative");
  const { data, isLoading: pointsLoading } = usePoints(currentSiteId || "");
  const { data: leaderboardData, isLoading: leaderboardLoading } =
    useLeaderboard(currentSiteId || null, rankingTab);

  const balance = data?.data?.balance || 0;
  const history = data?.data?.history || [];
  const leaderboard = leaderboardData?.leaderboard || [];
  const myRank = leaderboardData?.myRank;

  const renderRankBadge = (rank: number) => {
    if (rank === 1)
      return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
    if (rank === 2)
      return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
    if (rank === 3)
      return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
    return (
      <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">
        {rank}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />

      <main className="p-4 space-y-4">
        {pointsLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <PointsCard balance={balance} />
        )}

        <Card className="overflow-hidden border-amber-200">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-amber-900">랭킹</h3>
            </div>
            <div className="flex gap-1 bg-amber-100/50 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setRankingTab("monthly")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded-md transition-colors ${
                  rankingTab === "monthly"
                    ? "bg-white text-amber-900 font-medium shadow-sm"
                    : "text-amber-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                이번 달
              </button>
              <button
                type="button"
                onClick={() => setRankingTab("cumulative")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-sm rounded-md transition-colors ${
                  rankingTab === "cumulative"
                    ? "bg-white text-amber-900 font-medium shadow-sm"
                    : "text-amber-700"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                누적
              </button>
            </div>
          </div>
          <CardContent className="p-0">
            {leaderboardLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : leaderboard.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {leaderboard.slice(0, 10).map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-3 ${
                      entry.isCurrentUser ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        {renderRankBadge(entry.rank)}
                      </div>
                      <div className="font-medium text-gray-900">
                        {entry.nameMasked}
                        {entry.isCurrentUser && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs border-amber-500 text-amber-600 bg-white"
                          >
                            나
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-gray-700 text-sm">
                      {entry.totalPoints.toLocaleString()} P
                    </div>
                  </div>
                ))}

                {myRank && myRank > 10 && (
                  <>
                    <div className="p-2 text-center text-gray-400 text-xs">
                      •••
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 border-t border-amber-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          <span className="text-sm font-bold text-amber-600">
                            {myRank}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900">
                          {leaderboard.find((e) => e.isCurrentUser)
                            ?.nameMasked || "나"}
                          <Badge
                            variant="outline"
                            className="ml-2 text-xs border-amber-500 text-amber-600 bg-white"
                          >
                            나
                          </Badge>
                        </div>
                      </div>
                      <div className="font-bold text-gray-700 text-sm">
                        {leaderboard
                          .find((e) => e.isCurrentUser)
                          ?.totalPoints.toLocaleString() || 0}{" "}
                        P
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 text-sm">
                아직 랭킹 데이터가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="font-medium mb-4">포인트 내역</h3>
            {pointsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {(
                  history as Array<{
                    id: string;
                    amount: number;
                    reason: string;
                    createdAt: string;
                  }>
                ).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <span
                      className={`font-bold ${item.amount > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {item.amount > 0 ? "+" : ""}
                      {item.amount} P
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                포인트 내역이 없습니다.
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
