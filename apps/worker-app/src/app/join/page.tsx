"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import type { ApiResponse } from "@safetywallet/types";

export default function JoinSitePage() {
  const router = useRouter();
  const { setCurrentSite, isAuthenticated, _hasHydrated } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await apiFetch<
        ApiResponse<{ siteId: string; siteName: string }>
      >("/sites/join", {
        method: "POST",
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      setCurrentSite(response.data.siteId);
      router.replace("/home");
    } catch (err) {
      if (err && typeof err === "object" && "message" in err) {
        setError((err as { message: string }).message);
      } else {
        setError("현장 참여에 실패했습니다. 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">현장 참여</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            관리자에게 받은 참여 코드를 입력해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="joinCode" className="text-sm font-medium">
              참여 코드
            </label>
            <input
              id="joinCode"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="예: A1B2C3D4"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
              maxLength={8}
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !joinCode.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "참여 중..." : "현장 참여하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
