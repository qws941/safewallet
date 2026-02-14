"use client";

import { useState, useEffect } from "react";
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
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import type {
  ApiResponse,
  AuthResponseDto,
  MeResponseDto,
} from "@safetywallet/types";

const ERROR_CODES: Record<string, string> = {
  USER_NOT_FOUND: "auth.error.accountNotFound",
  NAME_MISMATCH: "auth.error.invalidCredentials",
  ATTENDANCE_NOT_VERIFIED: "auth.error.accountLocked",
  ACCOUNT_LOCKED: "auth.error.accountLocked",
  RATE_LIMIT_EXCEEDED: "auth.error.tooManyAttempts",
};

function parseErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message);
      const code = parsed?.error?.code;
      if (code && ERROR_CODES[code]) {
        return t(ERROR_CODES[code]);
      }
      if (parsed?.error?.message) {
        return parsed.error.message;
      }
    } catch {
      return t("auth.error.unknown");
    }
  }
  return t("auth.error.unknown");
}

export default function LoginPage() {
  const { login, setCurrentSite, isAuthenticated, _hasHydrated } = useAuth();
  const t = useTranslation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    // Skip redirect during active login submission to avoid duplicate navigation
    if (_hasHydrated && isAuthenticated && !loading) {
      window.location.replace("/home/");
    }
  }, [_hasHydrated, isAuthenticated, loading]);

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

      try {
        const meResponse =
          await apiFetch<ApiResponse<MeResponseDto>>("/auth/me");
        if (meResponse.data.siteId) {
          setCurrentSite(meResponse.data.siteId);
        }
      } catch {
        // No site assignment — user can proceed without site
      }

      window.location.replace("/home/");
    } catch (err) {
      setError(parseErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const phoneClean = phone.trim().replace(/-/g, "");
  const dobClean = dob.trim().replace(/-/g, "");
  const isPhoneValid = /^\d{10,11}$/.test(phoneClean);
  const isDobValid = /^\d{6,8}$/.test(dobClean);
  const isFormValid = isPhoneValid && name.trim().length > 0 && isDobValid;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.loginPageTitle")}</CardTitle>
          <CardDescription>{t("auth.loginPageSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                {t("auth.phoneNumber")}
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
                {t("auth.name")}
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
                {t("auth.dateOfBirth")}
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
              {loading ? t("common.loading") : t("auth.loginButton")}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {t("auth.loginPageHint")}
              <br />
              {t("auth.loginPageNote")}
            </p>

            <p className="text-sm text-muted-foreground text-center">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="text-primary underline">
                {t("auth.switchToRegister")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
