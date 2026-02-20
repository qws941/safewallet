"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MobileHeader, MobileSidebar, Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/stores/auth";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, _hasHydrated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === "/login";

  const handleMobileMenuChange = useCallback((open: boolean) => {
    setMobileMenuOpen(open);
  }, []);

  useEffect(() => {
    if (isLoginPage || !_hasHydrated) return;
    if (!user || !isAdmin) {
      router.push("/login");
    }
  }, [isLoginPage, _hasHydrated, user, isAdmin, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!_hasHydrated || !user || !isAdmin) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar />
      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={handleMobileMenuChange}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
