"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

function normalizePath(p: string) {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function isPublicPath(pathname: string) {
  const p = normalizePath(pathname);
  return p === "/" || p === "/login" || p.startsWith("/login/");
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isAuthenticated, _hasHydrated } = useAuth();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated && !isPublicPath(pathname)) {
      router.replace("/login");
    }
  }, [isAuthenticated, _hasHydrated, pathname, router]);

  // Clear React Query cache on logout to prevent stale data across sessions
  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      queryClient.clear();
    }
  }, [_hasHydrated, isAuthenticated, queryClient]);

  // Public paths render immediately without waiting for hydration
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // Protected paths: show spinner while hydrating or redirecting
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
