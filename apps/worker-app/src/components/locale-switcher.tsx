"use client";

import { useState } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@safetywallet/ui";
import { Globe } from "lucide-react";
import { localeNames, locales } from "@/i18n/config";
import type { Locale } from "@/i18n/config";

export function LocaleSwitcher() {
  const t = useTranslation();
  const { currentLocale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const handleLocaleChange = (locale: Locale) => {
    setLocale(locale);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
        aria-label={t("common.language")}
      >
        <Globe className="w-4 h-4" />
        <span className="text-xs font-medium">
          {currentLocale.toUpperCase()}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleLocaleChange(locale)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                currentLocale === locale
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {localeNames[locale]}
            </button>
          ))}
        </div>
      )}

      {/* Close menu when clicking outside */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
