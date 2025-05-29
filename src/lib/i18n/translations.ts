// src/lib/i18n/translations.ts
import { defaultLocale, availableLocales, fallbackChain, getBaseLanguage } from './config';

// In-memory cache for loaded translations
const translationCache: Record<string, Record<string, string>> = {};

// Function to get translations for a specific locale with fallback support
export const getTranslations = async (locale: string): Promise<Record<string, string>> => {
  // If translations are already in cache, return them
  if (translationCache[locale]) {
    return translationCache[locale];
  }
  
  try {
    // First try to load the exact locale
    let translations: Record<string, string> = {};
    
    try {
      // Try to load the specific locale (e.g., 'en-US')
      translations = await import(`@/translations/${locale}.json`)
        .then(module => module.default);
    } catch (error) {
      // If that fails, try the fallbacks
      console.warn(`Translations for locale ${locale} not found, trying fallbacks`);
      
      let loaded = false;
      const fallbacks = fallbackChain[locale] || [];
      
      // Try each fallback in the chain
      for (const fallbackLocale of fallbacks) {
        try {
          translations = await import(`@/translations/${fallbackLocale}.json`)
            .then(module => module.default);
          loaded = true;
          console.log(`Using fallback translations from ${fallbackLocale}`);
          break;
        } catch (fallbackError) {
          console.warn(`Fallback translations for ${fallbackLocale} not found`);
        }
      }
      
      // If no fallbacks worked, try the base language
      if (!loaded) {
        const baseLanguage = getBaseLanguage(locale);
        try {
          translations = await import(`@/translations/${baseLanguage}.json`)
            .then(module => module.default);
          console.log(`Using base language translations from ${baseLanguage}`);
        } catch (baseError) {
          // Last resort: use default locale
          console.warn(`Base language translations for ${baseLanguage} not found, using default locale`);
          translations = await import(`@/translations/${defaultLocale}.json`)
            .then(module => module.default);
        }
      }
    }
    
    translationCache[locale] = translations;
    return translations;
  } catch (error) {
    console.error('Error loading translations:', error);
    return {};
  }
};

// Function to save translations (used in the Translations tab)
export const saveTranslations = async (
  locale: string, 
  translations: Record<string, string>
): Promise<boolean> => {
  try {
    // Update cache
    translationCache[locale] = translations;
    
    // Send translations to the backend API
    const response = await fetch('/api/translations/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locale,
        translations,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to save translations for ${locale}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving translations:', error);
    return false;
  }
};

// Function to add a new language
export const addNewLanguage = async (
  localeCode: string, 
  localeName: string
): Promise<boolean> => {
  try {
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
      throw new Error(errorData.message || 'Failed to add new language');
    }
    
    // Clear cache to ensure we fetch the updated translations next time
    Object.keys(translationCache).forEach(key => {
      delete translationCache[key];
    });
    
    return true;
  } catch (error) {
    console.error('Error adding new language:', error);
    return false;
  }
};

// Function to import translations from CSV
export const importTranslationsFromCSV = async (
  csvData: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/translations/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvData,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to import translations');
    }
    
    // Clear cache to ensure we fetch the updated translations next time
    Object.keys(translationCache).forEach(key => {
      delete translationCache[key];
    });
    
    return true;
  } catch (error) {
    console.error('Error importing translations:', error);
    return false;
  }
};

// Function to get all translation keys from the default locale
export const getAllTranslationKeys = async (): Promise<string[]> => {
  const defaultTranslations = await getTranslations(defaultLocale);
  return Object.keys(defaultTranslations);
};

// Function to get all translations for all locales
export const getAllTranslations = async (): Promise<
  Record<string, Record<string, string>>
> => {
  const result: Record<string, Record<string, string>> = {};
  
  // Load translations for all available locales
  for (const locale of availableLocales) {
    result[locale] = await getTranslations(locale);
  }
  
  return result;
};