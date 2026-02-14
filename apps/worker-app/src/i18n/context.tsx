'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import type { Locale } from './config';
import { defaultLocale, locales } from './config';
import { getLocale } from './loader';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Record<string, any>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale?: Locale;
  initialMessages?: Record<string, any>;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
  const [messages, setMessages] = useState<Record<string, any>>(initialMessages || {});
  const [isLoading, setIsLoading] = useState(!initialMessages);

  useEffect(() => {
    // Load messages from localStorage on mount
    const savedLocale = localStorage.getItem('locale') as Locale | null;
    if (savedLocale && locales.includes(savedLocale)) {
      loadLocale(savedLocale);
    } else if (!initialMessages) {
      loadLocale(locale);
    }
  }, []);

  const loadLocale = async (newLocale: Locale) => {
    setIsLoading(true);
    try {
      const newMessages = await getLocale(newLocale);
      setLocaleState(newLocale);
      setMessages(newMessages);
      localStorage.setItem('locale', newLocale);
    } catch (error) {
      console.error('Failed to load locale:', error);
      setLocaleState(defaultLocale);
    } finally {
      setIsLoading(false);
    }
  };

  const setLocale = (newLocale: Locale) => {
    loadLocale(newLocale);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, messages, isLoading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
