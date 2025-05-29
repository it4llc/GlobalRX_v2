// src/lib/i18n/config.ts

// Default locale is US English
export const defaultLocale = 'en-US';

// Available locales with regional variations
export const availableLocales = [
  'en-US',  // English (United States)
  'en-GB',  // English (United Kingdom)
  'es-ES',  // Spanish (Spain)
  'ja-JP'   // Japanese (Japan)
];

// Base languages without region
export const baseLanguages: Record<string, string[]> = {
  'en': ['en-US', 'en-GB'],
  'es': ['es-ES'],
  'ja': ['ja-JP']
};

// Locale display names
export const localeNames: Record<string, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Español',
  'ja-JP': '日本語'
};

// Get the base language from a locale
export function getBaseLanguage(locale: string): string {
  return locale.split('-')[0];
}

// Get all locales for a base language
export function getRegionalVariants(baseLanguage: string): string[] {
  return baseLanguages[baseLanguage] || [];
}

// Fallback chain for locales
// When a translation is missing in a specific regional variant, try these in order
export const fallbackChain: Record<string, string[]> = {
  'en-GB': ['en-US'],       // UK English falls back to US English
  'en-US': [],              // US English is the base, no fallback
  'es-ES': [],              // Spanish (Spain) is the base, no fallback
  'ja-JP': [],              // Japanese is the base, no fallback
};

// Function to add a new locale to the configuration
export async function addNewLocale(localeCode: string, localeName: string): Promise<void> {
  try {
    // Make API call to add new locale
    const response = await fetch('/api/translations/add-locale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        localeCode,
        localeName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to add new locale');
    }

    // Return success
    return Promise.resolve();
  } catch (error) {
    console.error('Error adding new locale:', error);
    return Promise.reject(error);
  }
}