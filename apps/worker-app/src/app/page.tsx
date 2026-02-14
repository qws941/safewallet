"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export default function RootPage() {
  const { isAuthenticated, _hasHydrated } = useAuth();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      window.location.replace("/login/");
    } else {
      window.location.replace("/home/");
    }
  }, [isAuthenticated, _hasHydrated]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
