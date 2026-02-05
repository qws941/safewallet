'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-api';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { Card, CardContent, Button, Avatar, AvatarFallback, Skeleton } from '@safetywallet/ui';

export default function ProfilePage() {
  const router = useRouter();
  const { logout, currentSiteId } = useAuth();
  const { data, isLoading } = useProfile();

  const user = data?.data;

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleLeaveSite = () => {
    // TODO: Implement leave site
    alert('현장 탈퇴 기능은 준비 중입니다.');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      <Header />
      
      <main className="p-4 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="py-6">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {user?.nameMasked?.slice(0, 1) || '👷'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{user?.nameMasked || '이름 없음'}</h2>
                  <p className="text-sm text-muted-foreground">{user?.phone}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Site Info */}
        {currentSiteId && (
          <Card>
            <CardContent className="py-4">
              <h3 className="font-medium mb-2">현재 현장</h3>
              <p className="text-sm text-muted-foreground">ID: {currentSiteId}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start" onClick={handleLeaveSite}>
            <span className="mr-2">📍</span>
            현장 탈퇴하기
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleLogout}>
            <span className="mr-2">🚶</span>
            로그아웃
          </Button>
        </div>

        {/* App Info */}
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            <p>안전지갑 v0.1.0</p>
            <p>&copy; 2025 SafetyWallet</p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
