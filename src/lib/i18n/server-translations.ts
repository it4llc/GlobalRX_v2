// src/lib/i18n/server-translations.ts
import { getTranslations } from './translations';
import { defaultLocale } from './config';

/**
 * Get translations for server-side usage (API routes)
 * Extracts locale from Accept-Language header or uses default
 */
export async function getServerTranslations(request?: Request) {
  let locale = defaultLocale;

  // Try to get locale from Accept-Language header if request is provided
  if (request) {
    const acceptLanguage = request.headers.get('Accept-Language');
    if (acceptLanguage) {
      // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
      const languages = acceptLanguage.split(',');
      if (languages.length > 0) {
        // Get the first preferred language
        const preferred = languages[0].split(';')[0].trim();
        // Check if it's a valid locale format (e.g., en-US, es-ES)
        if (preferred.match(/^[a-z]{2}-[A-Z]{2}$/)) {
          locale = preferred;
        } else if (preferred.match(/^[a-z]{2}$/)) {
          // If it's just a language code (e.g., 'en'), map it to default regional variant
          const langMap: Record<string, string> = {
            'en': 'en-US',
            'es': 'es-ES',
            'ja': 'ja-JP'
          };
          locale = langMap[preferred] || defaultLocale;
        }
      }
    }
  }

  // Get translations for the locale
  const translations = await getTranslations(locale);

  // Create a translation function
  const t = (key: string, replacements?: Record<string, string | number>): string => {
    let text = translations[key] || key;

    // Handle replacements if provided
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(value));
      });
    }

    return text;
  };

  return t;
}