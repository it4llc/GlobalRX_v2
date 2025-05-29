// src/components/layout/language-selector.tsx
"use client";

import { useTranslation } from "@/contexts/TranslationContext";
import { availableLocales, localeNames } from "@/lib/i18n/config";

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();

  return (
    <select 
      value={locale} 
      onChange={(e) => setLocale(e.target.value)}
      className="text-sm rounded border border-gray-300 px-2 py-1"
    >
      {availableLocales.map((localeOption) => (
        <option key={localeOption} value={localeOption}>
          {localeNames[localeOption] || localeOption}
        </option>
      ))}
    </select>
  );
}