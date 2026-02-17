"use client";

import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { LocaleSwitcher } from "./locale-switcher";
import { SystemBanner } from "./system-banner";

export function Header() {
  const t = useTranslation();
  const { currentSiteId } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 safe-top">
      <div className="flex items-center justify-between h-14 px-4">
        <h1 className="text-lg font-bold text-primary">
          {t("components.appTitle")}
        </h1>
        <div className="flex items-center gap-2">
          {currentSiteId && (
            <span className="text-sm text-muted-foreground">
              {t("components.siteIdLabel")} {currentSiteId.slice(0, 8)}
            </span>
          )}
          <LocaleSwitcher />
        </div>
      </div>
      <SystemBanner />
    </header>
  );
}
