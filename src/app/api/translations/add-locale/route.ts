// src/app/api/translations/add-locale/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Interface for the request body
interface AddLocaleRequest {
  localeCode: string;
  localeName: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: AddLocaleRequest = await request.json();
    const { localeCode, localeName } = body;
    
    // Validate inputs
    if (!localeCode || !localeName) {
      return NextResponse.json(
        { error: 'Locale code and name are required' },
        { status: 400 }
      );
    }
    
    // 1. Create a new empty translations file based on the English one
    const translationsDir = path.join(process.cwd(), 'src', 'translations');
    const newTranslationFilePath = path.join(translationsDir, `${localeCode}.json`);
    const enTranslationsPath = path.join(translationsDir, 'en.json');
    
    // Check if the locale file already exists
    if (fs.existsSync(newTranslationFilePath)) {
      return NextResponse.json(
        { error: `Locale file for '${localeCode}' already exists` },
        { status: 400 }
      );
    }
    
    // Read English translations
    const enTranslationsRaw = fs.readFileSync(enTranslationsPath, 'utf-8');
    const enTranslations = JSON.parse(enTranslationsRaw);
    
    // Create a new translations object with empty strings
    const newTranslations: Record<string, string> = {};
    Object.keys(enTranslations).forEach(key => {
      newTranslations[key] = '';
    });
    
    // Write to the new file
    fs.writeFileSync(
      newTranslationFilePath,
      JSON.stringify(newTranslations, null, 2),
      'utf-8'
    );
    
    // 2. Update the config.ts file
    const configPath = path.join(process.cwd(), 'src', 'lib', 'i18n', 'config.ts');
    let configContent = fs.readFileSync(configPath, 'utf-8');
    
    // Update availableLocales array
    const availableLocalesRegex = /(export\s+const\s+availableLocales\s*=\s*\[)(.*?)(\];)/s;
    const availableLocalesMatch = configContent.match(availableLocalesRegex);
    
    if (availableLocalesMatch) {
      const currentLocales = availableLocalesMatch[2].split(',').map(s => s.trim());
      const newLocalesStr = currentLocales.length > 0 
        ? `${availableLocalesMatch[2]}, '${localeCode}'` 
        : `'${localeCode}'`;
      
      configContent = configContent.replace(
        availableLocalesRegex,
        `$1${newLocalesStr}$3`
      );
    }
    
    // Update localeNames object
    const localeNamesRegex = /(export\s+const\s+localeNames\s*:\s*Record<string,\s*string>\s*=\s*\{)(.*?)(\};)/s;
    const localeNamesMatch = configContent.match(localeNamesRegex);
    
    if (localeNamesMatch) {
      const updatedLocaleNamesContent = `${localeNamesMatch[2]}\n  ${localeCode}: '${localeName}',`;
      configContent = configContent.replace(
        localeNamesRegex,
        `$1${updatedLocaleNamesContent}$3`
      );
    }
    
    // Write the updated config file
    fs.writeFileSync(configPath, configContent, 'utf-8');
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: `Successfully added locale ${localeCode} (${localeName})` 
    });
    
  } catch (error) {
    console.error('Error adding new locale:', error);
    return NextResponse.json(
      { error: 'Failed to add new locale', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}