// src/app/api/translations/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { localeNames } from '@/lib/i18n/config';

// Interface for the request body
interface ImportTranslationsRequest {
  csvData: string;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: ImportTranslationsRequest = await request.json();
    const { csvData } = body;
    
    // Validate inputs
    if (!csvData) {
      return NextResponse.json(
        { error: 'CSV data is required' },
        { status: 400 }
      );
    }
    
    // Parse CSV data using PapaParse
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true
    });
    
    // Check for parsing errors
    if (parseResult.errors && parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to parse CSV data', details: parseResult.errors },
        { status: 400 }
      );
    }
    
    const parsedData = parseResult.data as Record<string, string>[];
    
    // Get column headers
    const headers = parseResult.meta.fields || [];
    
    // First column should be 'key'
    if (headers[0] !== 'key') {
      return NextResponse.json(
        { error: 'CSV format is invalid. First column must be "key"' },
        { status: 400 }
      );
    }
    
    // Map locale names to locale codes
    const localeColumns: Record<string, string> = {};
    headers.slice(1).forEach(header => {
      const localeCode = Object.keys(localeNames).find(
        code => localeNames[code] === header
      );
      
      if (localeCode) {
        localeColumns[header] = localeCode;
      }
    });
    
    if (Object.keys(localeColumns).length === 0) {
      return NextResponse.json(
        { error: 'No valid locale columns found in CSV' },
        { status: 400 }
      );
    }
    
    // Organize data by locale
    const importedTranslations: Record<string, Record<string, string>> = {};
    
    // Initialize translation objects for each locale
    Object.values(localeColumns).forEach(localeCode => {
      importedTranslations[localeCode] = {};
    });
    
    // Process each row
    parsedData.forEach(row => {
      const key = row['key'];
      
      if (!key) return; // Skip rows without keys
      
      // Process each locale column
      Object.entries(localeColumns).forEach(([header, localeCode]) => {
        const translation = row[header] || '';
        importedTranslations[localeCode][key] = translation;
      });
    });
    
    // Save each locale's translations to a file
    const translationsDir = path.join(process.cwd(), 'src', 'translations');
    
    for (const [localeCode, translations] of Object.entries(importedTranslations)) {
      const filePath = path.join(translationsDir, `${localeCode}.json`);
      
      // Check if the file exists
      if (fs.existsSync(filePath)) {
        // Read existing translations
        const existingContent = fs.readFileSync(filePath, 'utf-8');
        const existingTranslations = JSON.parse(existingContent);
        
        // Merge with new translations (overwrite existing keys)
        const mergedTranslations = {
          ...existingTranslations,
          ...translations
        };
        
        // Write back to file
        fs.writeFileSync(
          filePath,
          JSON.stringify(mergedTranslations, null, 2),
          'utf-8'
        );
      } else {
        // Create new file
        fs.writeFileSync(
          filePath,
          JSON.stringify(translations, null, 2),
          'utf-8'
        );
      }
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Translations imported successfully',
      locales: Object.values(localeColumns)
    });
  } catch (error: unknown) {
    logger.error('Error importing translations:', error);
    return NextResponse.json(
      { error: 'Failed to import translations', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}