"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://safework2-api.jclee.workers.dev/api";

export default function BypassPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <BypassContent />
    </Suspense>
  );
}

function BypassContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const login = useAuthStore((s) => s.login);
  const setCurrentSite = useAuthStore((s) => s.setCurrentSite);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !secret) {
      setError("필수 파라미터가 없습니다.");
      return;
    }

    const doBypass = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/auth/bypass/${userId}?secret=${encodeURIComponent(secret)}`,
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message || "바이패스 로그인에 실패했습니다.");
          return;
        }

        const data = await res.json();
        const { accessToken, refreshToken, user, currentSiteId } = data.data;

        login(user, accessToken, refreshToken);
        if (currentSiteId) {
          setCurrentSite(currentSiteId);
        }
        router.replace("/");
      } catch {
        setError("로그인 처리 중 오류가 발생했습니다.");
      }
    };

    doBypass();
  }, [userId, secret, login, setCurrentSite, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
        <div className="text-destructive text-center">{error}</div>
        <button
          type="button"
          onClick={() => router.replace("/login")}
          className="text-primary underline"
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground text-sm">로그인 처리 중...</p>
      </div>
    </div>
  );
}
