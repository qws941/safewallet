"use client";

import { useState } from "react";
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
import type { ApiResponse, AuthResponseDto } from "@safetywallet/types";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Convert 6-digit DOB (YYMMDD) to 8-digit (YYYYMMDD)
      const dob6 = dob.replace(/[^0-9]/g, "");
      const year2 = parseInt(dob6.slice(0, 2), 10);
      const fullYear =
        year2 >= 0 && year2 <= 30
          ? `20${dob6.slice(0, 2)}`
          : `19${dob6.slice(0, 2)}`;
      const dob8 = `${fullYear}${dob6.slice(2)}`;

      const response = await apiFetch<ApiResponse<AuthResponseDto>>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.replace(/[^0-9]/g, ""),
            dob: dob8,
          }),
          skipAuth: true,
        },
      );

      const { accessToken, refreshToken, user } = response.data;
      login(user, accessToken, refreshToken);
      router.replace("/join");
    } catch (err) {
      let errorMessage = "로그인에 실패했습니다.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          const code = parsed?.error?.code;
          if (code === "USER_NOT_FOUND") {
            errorMessage =
              "등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.";
          } else if (code === "ATTENDANCE_NOT_VERIFIED") {
            errorMessage =
              "오늘 출근 인증이 필요합니다. QR 코드를 스캔해주세요.";
          } else if (parsed?.error?.message) {
            errorMessage = parsed.error.message;
          }
        } catch {
          errorMessage = err.message || "로그인에 실패했습니다.";
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    name.trim().length > 0 &&
    phone.replace(/[^0-9]/g, "").length >= 10 &&
    dob.replace(/[^0-9]/g, "").length === 6;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">안전지갑</CardTitle>
          <CardDescription>본인 확인을 위해 정보를 입력하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
              <label htmlFor="phone" className="text-sm font-medium">
                휴대폰 번호
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dob" className="text-sm font-medium">
                생년월일 (6자리)
              </label>
              <Input
                id="dob"
                type="text"
                inputMode="numeric"
                placeholder="YYMMDD (예: 850101)"
                value={dob}
                onChange={(e) =>
                  setDob(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                disabled={loading}
                maxLength={6}
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
              FAS 안면인식 시스템에 등록된 정보로 로그인합니다.
              <br />
              등록되지 않은 경우 현장 관리자에게 문의하세요.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
