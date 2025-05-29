// src/components/modules/global-config/tabs/translations-tab.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { TranslationManager } from '@/components/modules/translations/TranslationManager';
import { Button } from '@/components/ui/button';
import { availableLocales, localeNames } from '@/lib/i18n/config';
import { useTranslation } from '@/contexts/TranslationContext';
import { getTranslations, saveTranslations } from '@/lib/i18n/translations';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Papa from 'papaparse';

export function TranslationsTab() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [allTranslations, setAllTranslations] = useState<Record<string, Record<string, string>>>({});
  const [translationKeys, setTranslationKeys] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState('');
  const [newLocale, setNewLocale] = useState('');
  const [localeName, setLocaleName] = useState('');
  const [newLocaleError, setNewLocaleError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dialog refs
  const importDialogRef = useRef<HTMLDialogElement>(null);
  const addLanguageDialogRef = useRef<HTMLDialogElement>(null);
  
  // Load all translations for export
  useEffect(() => {
    async function loadAllTranslations() {
      setIsLoading(true);
      try {
        // Get translations for all available locales
        const translations: Record<string, Record<string, string>> = {};
        
        // First load English to get all keys
        const enTranslations = await getTranslations('en');
        const keys = Object.keys(enTranslations).sort();
        setTranslationKeys(keys);
        
        // Then load all other languages
        for (const locale of availableLocales) {
          translations[locale] = await getTranslations(locale);
        }
        
        setAllTranslations(translations);
      } catch (error) {
        console.error('Error loading translations:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllTranslations();
  }, []);

  // Handle export to CSV/Excel
  const handleExportToCSV = async () => {
    try {
      console.log("Export to CSV clicked");
      setIsLoading(true);
      
      // Prepare data in CSV format
      let csvContent = "key,"; // First column for keys
      
      // Add header row with locale names
      availableLocales.forEach(locale => {
        csvContent += `${localeNames[locale]},`;
      });
      csvContent = csvContent.slice(0, -1) + "\n"; // Remove trailing comma and add newline
      
      // Add rows for each translation key
      translationKeys.forEach(key => {
        csvContent += `${key},`;
        
        availableLocales.forEach(locale => {
          // Escape quotes and encode the translation
          const translation = allTranslations[locale]?.[key] || '';
          const escapedTranslation = translation.replace(/"/g, '""');
          csvContent += `"${escapedTranslation}",`;
        });
        
        csvContent = csvContent.slice(0, -1) + "\n"; // Remove trailing comma and add newline
      });
      
      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'translations.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error exporting translations:', error);
      alert('Error exporting translations');
      setIsLoading(false);
    }
  };

  // Handle file selection for import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError('');
    }
  };

  // Reset file input when dialog closes
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setImportFile(null);
    setImportError('');
  };

  // Open dialogs
  const openImportDialog = () => {
    resetFileInput();
    importDialogRef.current?.showModal();
  };

  const openAddLanguageDialog = () => {
    setNewLocale('');
    setLocaleName('');
    setNewLocaleError('');
    addLanguageDialogRef.current?.showModal();
  };

  // Close dialogs
  const closeImportDialog = () => {
    resetFileInput();
    importDialogRef.current?.close();
  };

  const closeAddLanguageDialog = () => {
    setNewLocale('');
    setLocaleName('');
    setNewLocaleError('');
    addLanguageDialogRef.current?.close();
  };

  // Handle CSV/Excel import
  const handleImportFromCSV = async () => {
    if (!importFile) {
      setImportError('Please select a file to import');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Read the file as text
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const csvText = event.target?.result as string;
          
          // Send to API
          const response = await fetch('/api/translations/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              csvData: csvText
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to import translations');
          }
          
          const result = await response.json();
          alert('Translations imported successfully!');
          closeImportDialog();
          
          // Reload the page to see changes
          window.location.reload();
        } catch (error) {
          console.error('Error importing translations:', error);
          setImportError('Error importing translations: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
          setIsLoading(false);
        }
      };
      
      fileReader.onerror = () => {
        setImportError('Error reading file');
        setIsLoading(false);
      };
      
      fileReader.readAsText(importFile);
      
    } catch (error) {
      console.error('Error importing translations:', error);
      setImportError('Error importing translations: ' + (error instanceof Error ? error.message : String(error)));
      setIsLoading(false);
    }
  };

  // Handle adding a new language
  const handleAddLanguage = async () => {
    // Reset error state
    setNewLocaleError('');
    
    // Validate inputs
    if (!newLocale || !localeName) {
      setNewLocaleError('Please enter both a locale code and a display name');
      return;
    }
    
    // Check if locale already exists
    if (availableLocales.includes(newLocale)) {
      setNewLocaleError(`Locale code "${newLocale}" already exists`);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Call to API to add new language
      const response = await fetch('/api/translations/add-locale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localeCode: newLocale,
          localeName,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add new language');
      }
      
      alert(`Successfully added new language: ${localeName} (${newLocale})`);
      closeAddLanguageDialog();
      
      // Reload the page to see changes
      window.location.reload();
    } catch (error) {
      console.error('Error adding new language:', error);
      setNewLocaleError('Error adding new language: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Translations Management</h2>
        <div className="flex gap-2">
          <Button 
            onClick={openAddLanguageDialog}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Add New Language'}
          </Button>
          <Button 
            variant="outline"
            onClick={openImportDialog}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Import from CSV'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleExportToCSV}
            disabled={isLoading || !translationKeys.length}
          >
            {isLoading ? 'Loading...' : 'Export to CSV'}
          </Button>
        </div>
      </div>

      {/* Import Dialog */}
      <dialog 
        ref={importDialogRef} 
        className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-md"
      >
        <div className="bg-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Import Translations from CSV</h3>
            <button 
              onClick={closeImportDialog}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="import-file" className="text-right">
                CSV File
              </Label>
              <div className="col-span-3">
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </div>
            </div>
            {importError && (
              <div className="text-red-500 text-sm mt-1">{importError}</div>
            )}
            <div className="col-span-4 text-sm text-gray-500">
              <p>The CSV should have the format exported by the "Export to CSV" button.</p>
              <p>First row should contain: key, English, Español, etc.</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={closeImportDialog}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportFromCSV}
              disabled={isLoading || !importFile}
            >
              {isLoading ? 'Importing...' : 'Import'}
            </Button>
          </div>
        </div>
      </dialog>

      {/* Add Language Dialog */}
<dialog 
  ref={addLanguageDialogRef} 
  className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-md"
>
  <div className="bg-white p-6">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-lg font-bold">Add New Language</h3>
      <button 
        onClick={closeAddLanguageDialog}
        className="text-gray-500 hover:text-gray-700"
      >
        ✕
      </button>
    </div>
    
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="locale-code" className="text-right">
          Locale Code
        </Label>
        <Input
          id="locale-code"
          value={newLocale}
          onChange={(e) => setNewLocale(e.target.value)}
          placeholder="e.g., en-US"
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="locale-name" className="text-right">
          Display Name
        </Label>
        <Input
          id="locale-name"
          value={localeName}
          onChange={(e) => setLocaleName(e.target.value)}
          placeholder="e.g., English (US)"
          className="col-span-3"
        />
      </div>
      {newLocaleError && (
        <div className="text-red-500 text-sm">{newLocaleError}</div>
      )}
      <div className="col-span-4 text-sm text-gray-500">
        <p>Enter the locale code using the format 'language-REGION' (e.g., 'en-US' for US English, 'en-GB' for UK English, 'ja-JP' for Japanese).</p>
        <p>The locale code should follow ISO standards - a two-letter language code, hyphen, and a two-letter region code in uppercase.</p>
        <p>The display name should be user-friendly (e.g., 'English (US)', 'English (UK)', '日本語').</p>
      </div>
    </div>
    
    <div className="flex justify-end gap-2 mt-4">
      <Button
        variant="outline"
        onClick={closeAddLanguageDialog}
      >
        Cancel
      </Button>
      <Button
        onClick={handleAddLanguage}
        disabled={isLoading || !newLocale || !localeName}
      >
        {isLoading ? 'Adding...' : 'Add Language'}
      </Button>
    </div>
  </div>
</dialog>

      {/* The TranslationManager component handles the main functionality */}
      <TranslationManager />
    </div>
  );
}