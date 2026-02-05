'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@safetywallet/ui';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@safetywallet/types';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setIsLoading(true);
    setError('');
    try {
      await apiFetch('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setStep('otp');
    } catch (err) {
      setError('인증번호 발송에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiFetch<{
        user: {
          id: string;
          phone: string;
          nameMasked: string;
          role: UserRole;
        };
        tokens: { accessToken: string; refreshToken: string };
      }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code: otp }),
      });

      if (
        result.user.role !== UserRole.SITE_ADMIN &&
        result.user.role !== UserRole.SUPER_ADMIN
      ) {
        setError('관리자 권한이 없습니다');
        return;
      }

      login(result.user, result.tokens);
      router.push('/dashboard');
    } catch (err) {
      setError('인증번호가 올바르지 않습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">안전지갑 관리자</h1>
          <p className="mt-2 text-muted-foreground">
            관리자 계정으로 로그인하세요
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                휴대폰 번호
              </label>
              <Input
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full"
              onClick={handleSendOtp}
              disabled={!phone || isLoading}
            >
              {isLoading ? '발송 중...' : '인증번호 받기'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                인증번호
              </label>
              <Input
                type="text"
                placeholder="6자리 인증번호"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={isLoading}
                maxLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full"
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || isLoading}
            >
              {isLoading ? '확인 중...' : '로그인'}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
              }}
            >
              다른 번호로 시도
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
