// src/contexts/TranslationContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { defaultLocale, availableLocales } from '@/lib/i18n/config';
import { getTranslations } from '@/lib/i18n/translations';

// Types for our translations
type TranslationRecord = Record<string, string>;

// Context type
interface TranslationContextType {
  locale: string;
  translations: TranslationRecord;
  t: (key: string) => string;
  setLocale: (locale: string) => void;
}

// Create a context for translations with default values
const TranslationContext = createContext<TranslationContextType>({
  locale: defaultLocale,
  translations: {},
  t: (key: string) => key,
  setLocale: () => {},
});

// Translation provider component
export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [translations, setTranslations] = useState<TranslationRecord>({});
  const [isMounted, setIsMounted] = useState(false);
  
  // Initialize state on client side only
  useEffect(() => {
    setIsMounted(true);
    const savedLocale = localStorage.getItem('globalrx-locale') || defaultLocale;
    if (availableLocales.includes(savedLocale)) {
      setLocaleState(savedLocale);
      loadTranslations(savedLocale);
    } else {
      // If saved locale isn't in available locales, use default
      setLocaleState(defaultLocale);
      loadTranslations(defaultLocale);
    }
  }, []);
  
  // Load translations for a specific locale
  const loadTranslations = async (localeToLoad: string) => {
    try {
      const translationsData = await getTranslations(localeToLoad);
      setTranslations(translationsData);
    } catch (error) {
      console.error(`Error loading translations for ${localeToLoad}:`, error);
    }
  };
  
  // Function to change locale
  const changeLocale = (newLocale: string) => {
    if (availableLocales.includes(newLocale)) {
      setLocaleState(newLocale);
      loadTranslations(newLocale);
      localStorage.setItem('globalrx-locale', newLocale);
      
      // Optional: Force a re-render of data-i18n-key elements
      setTimeout(() => {
        const elementsToTranslate = document.querySelectorAll('[data-i18n-key]');
        elementsToTranslate.forEach(async (element) => {
          const key = element.getAttribute('data-i18n-key');
          if (key) {
            const translationsData = await getTranslations(newLocale);
            if (element.hasAttribute('data-i18n-html')) {
              element.innerHTML = translationsData[key] || key;
            } else {
              element.textContent = translationsData[key] || key;
            }
          }
        });
      }, 0);
    } else {
      console.warn(`Locale ${newLocale} is not supported`);
    }
  };
  
  // Translation function
  const t = (key: string): string => {
    return translations[key] || key;
  };
  
  // During server-side rendering or initial mount, just render children
  if (!isMounted) {
    return <>{children}</>;
  }
  
  return (
    <TranslationContext.Provider value={{ locale, translations, t, setLocale: changeLocale }}>
      {children}
    </TranslationContext.Provider>
  );
}

// Hook to use translations
export function useTranslation() {
  return useContext(TranslationContext);
}