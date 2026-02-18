"use client";

import { useState } from "react";
import { useRecommendationStats } from "@/hooks/use-recommendations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Button,
  Skeleton,
} from "@safetywallet/ui";
import { Award, TrendingUp, Users, Calendar } from "lucide-react";

export default function RecommendationStatsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { data, isLoading } = useRecommendationStats(
    startDate || undefined,
    endDate || undefined,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          추천 통계
        </h1>
        <p className="text-muted-foreground mt-1">
          우수근로자 추천 현황을 확인합니다
        </p>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">시작일</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setStartDate(e.target.value)
            }
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">종료일</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setEndDate(e.target.value)
            }
            className="w-40"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            초기화
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>총 추천 수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Award className="h-8 w-8 text-yellow-500" />
                  <span className="text-3xl font-bold">
                    {data.totalRecommendations}
                  </span>
                  <span className="text-muted-foreground">건</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>피추천자 수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-8 w-8 text-blue-500" />
                  <span className="text-3xl font-bold">
                    {data.topRecommended.length}
                  </span>
                  <span className="text-muted-foreground">명</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>활성 일수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-8 w-8 text-green-500" />
                  <span className="text-3xl font-bold">
                    {data.dailyCounts.length}
                  </span>
                  <span className="text-muted-foreground">일</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>최다 추천 근로자 TOP 10</CardTitle>
              <CardDescription>가장 많이 추천받은 근로자 순위</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topRecommended.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  데이터 없음
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topRecommended.map((item, idx) => (
                    <div
                      key={`${item.recommendedName}-${item.tradeType}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-lg font-bold ${idx < 3 ? "text-yellow-500" : "text-muted-foreground"}`}
                        >
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-medium">{item.recommendedName}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.tradeType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold">{item.count}</span>
                        <span className="text-sm text-muted-foreground ml-1">
                          회
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>일별 추천 추이</CardTitle>
              <CardDescription>최근 30일간 일별 추천 현황</CardDescription>
            </CardHeader>
            <CardContent>
              {data.dailyCounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  데이터 없음
                </p>
              ) : (
                <div className="space-y-2">
                  {data.dailyCounts.map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24">
                        {day.date}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (day.count / Math.max(...data.dailyCounts.map((d) => d.count), 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">
                        {day.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
