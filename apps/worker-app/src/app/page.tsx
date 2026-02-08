"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, currentSiteId } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (!currentSiteId) {
      router.replace("/join");
    } else {
      router.replace("/home");
    }
  }, [isAuthenticated, currentSiteId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
