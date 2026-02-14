import type { Locale } from './config';
import { defaultLocale } from './config';

const locales: Record<Locale, () => Promise<Record<string, any>>> = {
  ko: () => import('../locales/ko.json').then((module) => module.default),
  en: () => import('../locales/en.json').then((module) => module.default),
};

export async function getLocale(locale?: Locale): Promise<Record<string, any>> {
  const resolvedLocale = (locale || defaultLocale) as Locale;

  try {
    const messages = await locales[resolvedLocale]?.();
    if (!messages) {
      console.warn(`Locale ${resolvedLocale} not found, falling back to ${defaultLocale}`);
      return await locales[defaultLocale]();
    }
    return messages;
  } catch (error) {
    console.error(`Failed to load locale ${resolvedLocale}:`, error);
    return await locales[defaultLocale]();
  }
}
