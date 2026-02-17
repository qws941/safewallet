"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@safetywallet/ui";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/lib/api";
import type { ApiResponse } from "@safetywallet/types";

const ERROR_CODES: Record<string, string> = {
  USER_EXISTS: "auth.error.accountNotFound",
  DEVICE_LIMIT: "auth.error.accountLocked",
  MISSING_FIELDS: "common.noData",
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

export default function RegisterPage() {
  const t = useTranslation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch<ApiResponse<{ userId: string }>>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          dob: dob.trim(),
        }),
        skipAuth: true,
      });

      setSuccess(true);
    } catch (err) {
      setError(parseErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    phone.trim().length > 0 && name.trim().length > 0 && dob.trim().length > 0;

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {t("auth.success.registerSuccess")}
            </CardTitle>
            <CardDescription>{t("common.ok")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full">{t("auth.loginButton")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.register")}</CardTitle>
          <CardDescription>{t("auth.register")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              {loading ? t("common.loading") : t("auth.registerButton")}
            </Button>

            <p className="text-sm text-muted-foreground text-center mt-4">
              {t("common.ok")}{" "}
              <Link href="/login" className="text-primary underline">
                {t("auth.switchToLogin")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
