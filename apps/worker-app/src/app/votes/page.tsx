"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
} from "@safetywallet/ui";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle, Send, History } from "lucide-react";

interface TodayData {
  hasRecommendedToday: boolean;
  recommendation: {
    id: string;
    recommendedName: string;
    tradeType: string;
    reason: string;
    recommendationDate: string;
  } | null;
}

interface RecommendationRecord {
  id: string;
  recommendedName: string;
  tradeType: string;
  reason: string;
  recommendationDate: string;
  createdAt: string;
}

export default function RecommendationsPage() {
  const router = useRouter();
  const { currentSiteId } = useAuth();
  const queryClient = useQueryClient();

  const [recommendedName, setRecommendedName] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [reason, setReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const { data: todayData, isLoading } = useQuery<TodayData>({
    queryKey: ["recommendations", "today", currentSiteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: TodayData }>(
        `/recommendations/today?siteId=${currentSiteId}`,
      );
      return res.data;
    },
    enabled: !!currentSiteId,
  });

  const { data: history } = useQuery<RecommendationRecord[]>({
    queryKey: ["recommendations", "my", currentSiteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: RecommendationRecord[] }>(
        `/recommendations/my?siteId=${currentSiteId}`,
      );
      return res.data;
    },
    enabled: !!currentSiteId && showHistory,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiFetch("/recommendations", {
        method: "POST",
        body: JSON.stringify({
          siteId: currentSiteId,
          recommendedName: recommendedName.trim(),
          tradeType: tradeType.trim(),
          reason: reason.trim(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recommendations", "today"],
      });
      setRecommendedName("");
      setTradeType("");
      setReason("");
    },
  });

  const handleSubmit = () => {
    if (recommendedName.trim() && tradeType.trim() && reason.trim()) {
      submitMutation.mutate();
    }
  };

  const isFormValid =
    recommendedName.trim().length > 0 &&
    tradeType.trim().length > 0 &&
    reason.trim().length > 0;

  if (!currentSiteId) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">현장을 먼저 선택해주세요.</p>
            <Button onClick={() => router.push("/join")} className="mt-4">
              현장 선택
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              우수 근로자 추천
            </CardTitle>
            <CardDescription>
              함께 일하는 우수한 동료를 추천해주세요 (하루 1회)
            </CardDescription>
          </CardHeader>
        </Card>

        {todayData?.hasRecommendedToday ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="font-medium text-green-700">오늘 추천 완료!</p>
              <p className="text-sm text-green-600 mt-1">
                내일 다시 추천할 수 있습니다.
              </p>
              {todayData.recommendation && (
                <div className="mt-4 p-3 bg-white rounded-lg text-left">
                  <p className="text-sm font-medium text-gray-700">
                    {todayData.recommendation.recommendedName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {todayData.recommendation.tradeType}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {todayData.recommendation.reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="tradeType"
                  className="text-sm font-medium leading-none"
                >
                  공종명
                </label>
                <Input
                  id="tradeType"
                  placeholder="예: 철근, 형틀, 전기, 설비"
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recommendedName"
                  className="text-sm font-medium leading-none"
                >
                  근로자 이름
                </label>
                <Input
                  id="recommendedName"
                  placeholder="추천할 근로자의 이름"
                  value={recommendedName}
                  onChange={(e) => setRecommendedName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="reason"
                  className="text-sm font-medium leading-none"
                >
                  추천 사유
                </label>
                <textarea
                  id="reason"
                  placeholder="추천 사유를 작성해주세요"
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setReason(e.target.value)
                  }
                  className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!isFormValid || submitMutation.isPending}
                onClick={handleSubmit}
              >
                {submitMutation.isPending ? (
                  "제출 중..."
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    추천하기
                  </span>
                )}
              </Button>

              {submitMutation.error && (
                <p className="text-sm text-destructive text-center">
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : "추천에 실패했습니다."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4 mr-2" />
          {showHistory ? "내 추천 내역 숨기기" : "내 추천 내역 보기"}
        </Button>

        {showHistory && history && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    추천 내역이 없습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              history.map((rec) => (
                <Card key={rec.id}>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm">
                          {rec.recommendedName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rec.tradeType}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {rec.recommendationDate}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{rec.reason}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
