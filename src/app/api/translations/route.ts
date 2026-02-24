// src/app/api/translations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';

// Handler for GET requests - retrieve translations for a specific locale
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Get the locale from the URL parameters
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale');
    
    // Validate locale parameter
    if (!locale) {
      return NextResponse.json(
        { error: 'Locale parameter is required' },
        { status: 400 }
      );
    }
    
    // Construct the path to the translations file
    const filePath = path.join(process.cwd(), 'src', 'translations', `${locale}.json`);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Translations for locale '${locale}' not found` },
        { status: 404 }
      );
    }
    
    // Read and parse the translations file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const translations = JSON.parse(fileContent);
    
    // Return the translations
    return NextResponse.json(translations);
  } catch (error) {
    logger.error('Error retrieving translations', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: 'Failed to retrieve translations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Handler for POST requests - save translations for a specific locale
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins should be able to modify translations
    if (!session.user?.permissions?.admin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }
    // Parse the request body
    const body = await request.json();
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
    logger.error('Error saving translations', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { error: 'Failed to save translations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}