'use client';

import { useI18n } from '@/i18n';
import { createTranslator } from '@/i18n/translate';

/**
 * Hook to get translation function with full type safety
 * Usage:
 *   const t = useTranslation();
 *   t('auth.login') => "로그인"
 *   t('posts.category.hazard') => "위험 상황"
 */
export function useTranslation() {
  const { messages } = useI18n();
  return createTranslator(messages);
}
