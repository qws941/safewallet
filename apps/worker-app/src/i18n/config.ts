// i18n configuration
export const defaultLocale = 'ko' as const;
export const locales = ['ko', 'en'] as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};
