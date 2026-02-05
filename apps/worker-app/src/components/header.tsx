'use client';

import { useAuth } from '@/hooks/use-auth';

export function Header() {
  const { currentSiteId } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 safe-top">
      <div className="flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold text-primary">안전지갑</h1>
        {currentSiteId && (
          <span className="text-sm text-muted-foreground">
            현장 ID: {currentSiteId.slice(0, 8)}
          </span>
        )}
      </div>
    </header>
  );
}
