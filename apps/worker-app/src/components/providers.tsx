"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@safetywallet/ui";
import { AuthGuard } from "./auth-guard";
import { I18nProvider } from "@/i18n";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale="ko">
        <AuthGuard>{children}</AuthGuard>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>
  );
}
