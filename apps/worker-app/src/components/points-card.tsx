'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@safetywallet/ui';

interface PointsCardProps {
  balance: number;
  recentPoints?: number;
}

export function PointsCard({ balance, recentPoints }: PointsCardProps) {
  return (
    <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium opacity-90">내 포인트</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {balance.toLocaleString('ko-KR')} P
        </div>
        {recentPoints !== undefined && recentPoints > 0 && (
          <p className="text-sm opacity-75 mt-1">
            이번 달 +{recentPoints.toLocaleString('ko-KR')} P
          </p>
        )}
      </CardContent>
    </Card>
  );
}
