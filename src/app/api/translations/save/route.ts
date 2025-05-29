// src/app/api/translations/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Interface for the request body
interface SaveTranslationsRequest {
  locale: string;
  translations: Record<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: SaveTranslationsRequest = await request.json();
    const { locale, translations } = body;
    
    // Validate inputs
    if (!locale || !translations) {
      return NextResponse.json(
        { error: 'Locale and translations are required' },
        { status: 400 }
      );
    }
    
    // Ensure translations is an object
    if (typeof translations !== 'object' || translations === null) {
      return NextResponse.json(
        { error: 'Translations must be an object' },
        { status: 400 }
      );
    }
    
    // Construct the path to the translations file
    const translationsDir = path.join(process.cwd(), 'src', 'translations');
    const filePath = path.join(translationsDir, `${locale}.json`);
    
    // Ensure the directory exists
    if (!fs.existsSync(translationsDir)) {
      fs.mkdirSync(translationsDir, { recursive: true });
    }
    
    // Write the translations to the file
    fs.writeFileSync(
      filePath,
      JSON.stringify(translations, null, 2),
      'utf-8'
    );
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: `Successfully saved translations for ${locale}` 
    });
  } catch (error) {
    console.error('Error saving translations:', error);
    return NextResponse.json(
      { error: 'Failed to save translations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}