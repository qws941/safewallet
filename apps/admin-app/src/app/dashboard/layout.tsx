'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileHeader, MobileSidebar } from '@/components/sidebar';
import { useAuthStore } from '@/stores/auth';
import { useMySites } from '@/hooks/use-admin-api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAdmin, _hasHydrated, currentSiteId, setSiteId } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: sites } = useMySites();

  const handleMobileMenuChange = useCallback((open: boolean) => {
    setMobileMenuOpen(open);
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || !isAdmin) {
      router.push('/login');
    }
  }, [user, isAdmin, _hasHydrated, router]);

  useEffect(() => {
    if (!currentSiteId && sites && sites.length > 0) {
      setSiteId(sites[0].siteId);
    }
  }, [currentSiteId, sites, setSiteId]);

  if (!_hasHydrated || !user || !isAdmin) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={handleMobileMenuChange} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
