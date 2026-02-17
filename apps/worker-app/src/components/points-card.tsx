"use client";

import { useTranslation } from "@/hooks/use-translation";
import { Card, CardContent, CardHeader, CardTitle } from "@safetywallet/ui";

interface PointsCardProps {
  balance: number;
  recentPoints?: number;
  delta?: number;
}

export function PointsCard({ balance, recentPoints, delta }: PointsCardProps) {
  const t = useTranslation();

  return (
    <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium opacity-90">
          {t("pointsCard.myPoints")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {balance.toLocaleString("ko-KR")} P
        </div>
        {recentPoints !== undefined && recentPoints > 0 && (
          <p className="text-sm opacity-75 mt-1">
            {t("pointsCard.thisMonth")} +{recentPoints.toLocaleString("ko-KR")}{" "}
            P
          </p>
        )}
        {delta !== undefined && delta !== 0 && (
          <p
            className={`text-xs mt-1 ${delta > 0 ? "opacity-90" : "opacity-75"}`}
          >
            {t("pointsCard.monthlyChange")} {delta > 0 ? "▲" : "▼"}{" "}
            {Math.abs(delta).toLocaleString("ko-KR")} P
          </p>
        )}
      </CardContent>
    </Card>
  );
}
