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

type LoginMode = "phone" | "acetime";

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
  const [mode, setMode] = useState<LoginMode>("phone");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");

  const [employeeCode, setEmployeeCode] = useState("");
  const [acetimeName, setAcetimeName] = useState("");

  useEffect(() => {
    if (_hasHydrated && isAuthenticated && !loading) {
      window.location.replace("/home/");
    }
  }, [_hasHydrated, isAuthenticated, loading]);

  const handleLoginSuccess = async (data: AuthResponseDto) => {
    login(data.user, data.accessToken, data.refreshToken);

    try {
      const meResponse = await apiFetch<ApiResponse<MeResponseDto>>("/auth/me");
      if (meResponse.data.siteId) {
        setCurrentSite(meResponse.data.siteId);
      }
    } catch {
      // No site assignment — user can proceed without site
    }

    window.location.replace("/home/");
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
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
      await handleLoginSuccess(response.data);
    } catch (err) {
      setError(parseErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleAcetimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch<ApiResponse<AuthResponseDto>>(
        "/auth/acetime-login",
        {
          method: "POST",
          body: JSON.stringify({
            employeeCode: employeeCode.trim(),
            name: acetimeName.trim(),
          }),
          skipAuth: true,
        },
      );
      await handleLoginSuccess(response.data);
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
  const isPhoneFormValid = isPhoneValid && name.trim().length > 0 && isDobValid;

  const isAcetimeFormValid =
    employeeCode.trim().length > 0 && acetimeName.trim().length > 0;

  const switchMode = (newMode: LoginMode) => {
    setMode(newMode);
    setError("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.loginPageTitle")}</CardTitle>
          <CardDescription>
            {mode === "phone"
              ? t("auth.loginPageSubtitle")
              : t("auth.acetimeLoginHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={mode === "phone" ? "default" : "outline"}
              className="flex-1 text-sm"
              onClick={() => switchMode("phone")}
              disabled={loading}
            >
              {t("auth.tabPhone")}
            </Button>
            <Button
              type="button"
              variant={mode === "acetime" ? "default" : "outline"}
              className="flex-1 text-sm"
              onClick={() => switchMode("acetime")}
              disabled={loading}
            >
              {t("auth.tabAcetime")}
            </Button>
          </div>

          {mode === "phone" ? (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
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
                disabled={loading || !isPhoneFormValid}
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
          ) : (
            <form onSubmit={handleAcetimeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="employeeCode" className="text-sm font-medium">
                  {t("auth.employeeCode")}
                </label>
                <Input
                  id="employeeCode"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("auth.employeeCodePlaceholder")}
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="acetimeName" className="text-sm font-medium">
                  {t("auth.name")}
                </label>
                <Input
                  id="acetimeName"
                  type="text"
                  placeholder="홍길동"
                  value={acetimeName}
                  onChange={(e) => setAcetimeName(e.target.value)}
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !isAcetimeFormValid}
              >
                {loading ? t("common.loading") : t("auth.loginButton")}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                {t("auth.acetimeLoginHint")}
                <br />
                {t("auth.acetimeLoginNote")}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
