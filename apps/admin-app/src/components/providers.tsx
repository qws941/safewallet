"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@safetywallet/ui";
import { useAuthStore } from "@/stores/auth";
import { useMySites } from "@/hooks/use-admin-api";

function SiteBootstrapGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, _hasHydrated, currentSiteId, setSiteId } =
    useAuthStore();
  const { data: sites, isLoading: isSitesLoading } = useMySites();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (isLoginPage) return;
    if (!currentSiteId && sites && sites.length > 0) {
      setSiteId(sites[0].siteId);
    }
  }, [isLoginPage, currentSiteId, sites, setSiteId]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!_hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        로딩 중...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <>{children}</>;
  }

  if (!currentSiteId) {
    if (isSitesLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          현장 정보를 불러오는 중입니다...
        </div>
      );
    }

    if (sites && sites.length === 0) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center text-slate-700">
          배정된 현장이 없습니다. 관리자에게 현장 배정을 요청하세요.
        </div>
      );
    }
  }

  return <>{children}</>;
}

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
      <SiteBootstrapGate>{children}</SiteBootstrapGate>
      <Toaster />
    </QueryClientProvider>
  );
}
