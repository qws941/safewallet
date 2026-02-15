import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { I18nContext } from "@/i18n/context";
import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n/config";

function createI18nWrapper(setLocale: (locale: Locale) => void) {
  function I18nWrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      I18nContext.Provider,
      {
        value: {
          locale: "ko",
          setLocale,
          messages: {},
          isLoading: false,
        },
      },
      children,
    );
  }
  return I18nWrapper;
}

describe("useLocale", () => {
  it("throws when used outside I18nProvider", () => {
    expect(() => renderHook(() => useLocale())).toThrow(
      "useLocale must be used within I18nProvider",
    );
  });

  it("returns current locale and persists locale changes to localStorage", () => {
    const setLocale = vi.fn();
    const wrapper = createI18nWrapper(setLocale);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useLocale(), { wrapper });

    result.current.setLocale("en");

    expect(result.current.currentLocale).toBe("ko");
    expect(setLocale).toHaveBeenCalledWith("en");
    expect(setItemSpy).toHaveBeenCalledWith("i18n-locale", "en");
  });

  it("does not persist locale when window is undefined", () => {
    const setLocale = vi.fn();
    const wrapper = createI18nWrapper(setLocale);
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useLocale(), { wrapper });

    vi.stubGlobal("window", undefined);
    result.current.setLocale("en");
    vi.unstubAllGlobals();

    expect(setLocale).toHaveBeenCalledWith("en");
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
