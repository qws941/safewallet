import type { Locale } from "./config";
import { defaultLocale } from "./config";

const locales: Partial<Record<Locale, () => Promise<Record<string, any>>>> = {
  ko: () => import("../locales/ko.json").then((module) => module.default),
  en: () => import("../locales/en.json").then((module) => module.default),
};

export async function getLocale(locale?: Locale): Promise<Record<string, any>> {
  const resolvedLocale = (locale || defaultLocale) as Locale;

  try {
    const loaderFn = locales[resolvedLocale];
    if (!loaderFn) {
      console.warn(
        `Locale ${resolvedLocale} not found, falling back to ${defaultLocale}`,
      );
      const fallbackFn = locales[defaultLocale];
      if (!fallbackFn)
        throw new Error(`Default locale ${defaultLocale} not found`);
      return await fallbackFn();
    }
    return await loaderFn();
  } catch (error) {
    console.error(`Failed to load locale ${resolvedLocale}:`, error);
    const fallbackFn = locales[defaultLocale];
    if (!fallbackFn)
      throw new Error(`Default locale ${defaultLocale} not found`);
    return await fallbackFn();
  }
}
