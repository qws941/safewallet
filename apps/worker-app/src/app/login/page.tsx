"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@safetywallet/ui";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";
import type {
  ApiResponse,
  AuthResponseDto,
  MeResponseDto,
} from "@safetywallet/types";

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.",
  NAME_MISMATCH: "이름이 일치하지 않습니다. 다시 확인해주세요.",
  ATTENDANCE_NOT_VERIFIED:
    "오늘 출근 기록이 없습니다. 출입 후 다시 시도하세요.",
  ACCOUNT_LOCKED: "계정이 일시 잠금되었습니다. 30분 후 다시 시도하세요.",
  RATE_LIMIT_EXCEEDED: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
};

function parseErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      const code = parsed?.error?.code;
      if (code && ERROR_MESSAGES[code]) {
        return ERROR_MESSAGES[code];
      }
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      return err.message || "로그인에 실패했습니다.";
    }
  }
  return "로그인에 실패했습니다.";
}

export default function LoginPage() {
  const router = useRouter();
  const {
    login,
    setCurrentSite,
    currentSiteId,
    isAuthenticated,
    _hasHydrated,
  } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    if (_hasHydrated && isAuthenticated) {
      router.replace(currentSiteId ? "/home" : "/join");
    }
  }, [_hasHydrated, isAuthenticated, currentSiteId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch<ApiResponse<AuthResponseDto>>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            dob: dob.trim(),
          }),
          skipAuth: true,
        },
      );
      const data = response.data;

      login(data.user, data.accessToken, data.refreshToken);
      let siteId: string | null = null;

      try {
        const meResponse =
          await apiFetch<ApiResponse<MeResponseDto>>("/auth/me");
        if (meResponse.data.siteId) {
          setCurrentSite(meResponse.data.siteId);
          siteId = meResponse.data.siteId;
        }
      } catch {
        siteId = null;
      }

      router.replace(siteId ? "/home" : "/join");
    } catch (err) {
      setError(parseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    phone.trim().length > 0 && name.trim().length > 0 && dob.trim().length > 0;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">안전지갑</CardTitle>
          <CardDescription>본인 확인을 위해 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                전화번호
              </label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                이름
              </label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="dob" className="text-sm font-medium">
                생년월일
              </label>
              <Input
                id="dob"
                type="text"
                inputMode="numeric"
                placeholder="19900101"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                disabled={loading}
                autoComplete="bday"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !isFormValid}
            >
              {loading ? "확인 중..." : "로그인"}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              등록된 전화번호, 이름, 생년월일로 로그인합니다.
              <br />
              최초 이용 시 출근 기록이 필요할 수 있습니다.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
