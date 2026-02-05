'use client';

import { useAuth } from '@/hooks/use-auth';
import { usePoints } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { PointsCard } from '@/components/points-card';
import { Card, CardContent, Skeleton } from '@safetywallet/ui';

export default function PointsPage() {
  const { currentSiteId } = useAuth();
  const { data, isLoading } = usePoints(currentSiteId || '');

  const balance = data?.data?.balance || 0;
  const history = data?.data?.history || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      
      <main className="p-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <PointsCard balance={balance} />
        )}

        <Card>
          <CardContent className="py-4">
            <h3 className="font-medium mb-4">포인트 내역</h3>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {(history as Array<{ id: string; amount: number; reason: string; createdAt: string }>).map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{item.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <span className={`font-bold ${item.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.amount > 0 ? '+' : ''}{item.amount} P
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
