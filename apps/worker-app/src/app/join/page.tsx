'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@safetywallet/ui';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import type { ApiResponse } from '@safetywallet/types';

export default function JoinPage() {
  const router = useRouter();
  const { setCurrentSite } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch<ApiResponse<{ siteId: string }>>('/sites/join', {
        method: 'POST',
        body: JSON.stringify({ joinCode }),
      });

      setCurrentSite(response.data.siteId);
      router.replace('/home');
    } catch (err) {
      setError('유효하지 않은 코드입니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">현장 참여</CardTitle>
          <CardDescription>
            QR 코드를 스캔하거나 참여 코드를 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="참여 코드 입력"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="text-center text-lg uppercase"
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !joinCode}>
              {loading ? '참여 중...' : '현장 참여하기'}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                // TODO: Implement QR scanner
                alert('QR 스캐너 기능은 준비 중입니다.');
              }}
            >
              QR 코드 스캔
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
