// src/hooks/useTranslate.tsx
"use client";

import { useTranslation } from '@/contexts/TranslationContext';
import { ReactNode } from 'react';

/**
 * A hook to easily use translations in client components
 * @returns An object with translation-related utilities
 */
export function useTranslate() {
  const { t, locale, setLocale } = useTranslation();

  /**
   * Translate a component that might have nested elements
   * This allows you to translate components while preserving their React structure
   */
  const Translate = ({ 
    children, 
    id 
  }: { 
    children: ReactNode;
    id: string;
  }) => {
    return <>{t(id)}</>;
  };

  return {
    t,         // The translation function
    locale,    // Current locale
    setLocale, // Function to change locale
    Translate  // Component for translating blocks
  };
}