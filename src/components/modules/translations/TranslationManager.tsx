"use client";

// src/components/modules/translations/TranslationManager.tsx
import clientLogger from '@/lib/client-logger';

import React, { useState, useEffect, useRef } from 'react';
import { availableLocales, localeNames, defaultLocale } from '@/lib/i18n/config';
import { getTranslations, saveTranslations } from '@/lib/i18n/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead,
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/contexts/TranslationContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertBox } from '@/components/ui/alert-box';
import { ModalDialog, DialogRef, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow, FormActions } from '@/components/ui/form';

export function TranslationManager() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('keys');
  const [translationKeys, setTranslationKeys] = useState<string[]>([]);
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form values
  const [newKey, setNewKey] = useState('');
  const [newTranslations, setNewTranslations] = useState<Record<string, string>>({});
  
  // New language state
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [newLocaleName, setNewLocaleName] = useState('');
  
  // Dialog refs
  const addKeyDialogRef = useRef<HTMLDialogElement>(null);
  const addLanguageDialogRef = useRef<HTMLDialogElement>(null);
  const importDialogRef = useRef<HTMLDialogElement>(null);

  // Load all translations
  useEffect(() => {
    async function loadAllTranslations() {
      try {
        setIsLoading(true);
        
        // Load all translation keys from the default locale
        const defaultTranslations = await getTranslations(defaultLocale);
        const keys = Object.keys(defaultTranslations).sort();
        setTranslationKeys(keys);
        
        // Load translations for all available locales
        const allTranslations: Record<string, Record<string, string>> = {};
        for (const locale of availableLocales) {
          allTranslations[locale] = await getTranslations(locale);
        }
        
        setTranslations(allTranslations);
        setUnsavedChanges({});
      } catch (error) {
        clientLogger.error('Error loading translations:', error);
        setErrorMessage(`Error loading translations: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllTranslations();
  }, []);

  // Filter keys based on search term
  const filteredKeys = translationKeys.filter(key => 
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    Object.values(translations).some(localeTranslations => 
      localeTranslations[key]?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Handle translation change
  const handleTranslationChange = (locale: string, key: string, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [key]: value
      }
    }));
    
    setUnsavedChanges(prev => ({
      ...prev,
      [locale]: true
    }));
  };

  // Save all changes
  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      
      // Get locales with unsaved changes
      const localesToSave = Object.entries(unsavedChanges)
        .filter(([, hasChanges]) => hasChanges)
        .map(([locale]) => locale);
      
      if (localesToSave.length === 0) {
        alert('No changes to save');
        return;
      }

      // Save each locale
      for (const locale of localesToSave) {
        // Send to API
        const response = await fetch('/api/translations/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locale,
            translations: translations[locale]
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to save translations for ${locale}`);
        }
      }
      
      // Reset unsaved changes
      setUnsavedChanges({});
      
      alert(`All changes saved successfully!`);
    } catch (error) {
      clientLogger.error('Error saving translations:', error);
      setErrorMessage(`Error saving translations: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Save translations for a specific locale
  const handleSave = async (locale: string) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Send to API
      const response = await fetch('/api/translations/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale,
          translations: translations[locale]
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to save translations for ${locale}`);
      }
      
      setUnsavedChanges(prev => ({
        ...prev,
        [locale]: false
      }));
      
      alert(`Translations for ${localeNames[locale]} saved successfully!`);
    } catch (error) {
      clientLogger.error('Error saving translations:', error);
      setErrorMessage(`Error saving translations for ${localeNames[locale]}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Open Add Key dialog
  const openAddKeyDialog = () => {
    setNewKey('');
    // Initialize empty translations for all locales
    const initialTranslations: Record<string, string> = {};
    availableLocales.forEach(locale => {
      initialTranslations[locale] = '';
    });
    setNewTranslations(initialTranslations);
    setErrorMessage(null);
    addKeyDialogRef.current?.showModal();
  };

  // Close Add Key dialog
  const closeAddKeyDialog = () => {
    setNewKey('');
    setNewTranslations({});
    setErrorMessage(null);
    addKeyDialogRef.current?.close();
  };

  // Open Add Language dialog
  const openAddLanguageDialog = () => {
    setNewLocaleCode('');
    setNewLocaleName('');
    setErrorMessage(null);
    addLanguageDialogRef.current?.showModal();
  };

  // Close Add Language dialog
  const closeAddLanguageDialog = () => {
    setNewLocaleCode('');
    setNewLocaleName('');
    setErrorMessage(null);
    addLanguageDialogRef.current?.close();
  };

  // Open Import dialog
  const openImportDialog = () => {
    importDialogRef.current?.showModal();
  };

  // Handle individual translation change in the dialog
  const handleNewTranslationChange = (locale: string, value: string) => {
    setNewTranslations(prev => ({
      ...prev,
      [locale]: value
    }));
  };

  // Add a new translation key with translations for all locales
  const handleAddKey = async () => {
    if (!newKey) {
      setErrorMessage('Translation key is required');
      return;
    }
    
    // Check if any required translations are missing
    const missingTranslations = availableLocales.filter(locale => !newTranslations[locale]);
    if (missingTranslations.length > 0) {
      setErrorMessage(`Translations are required for all languages: ${missingTranslations.map(locale => localeNames[locale]).join(', ')}`);
      return;
    }
    
    if (translationKeys.includes(newKey)) {
      setErrorMessage('This key already exists');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Save translations for each locale
      for (const locale of availableLocales) {
        // 1. Get current translations for this locale
        const currentTranslations = await getTranslations(locale);
        
        // 2. Add the new key to the existing translations
        const updatedTranslations = {
          ...currentTranslations,
          [newKey]: newTranslations[locale]
        };
        
        // 3. Save the updated translations
        const response = await fetch('/api/translations/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            locale,
            translations: updatedTranslations
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to save translations for ${locale}`);
        }
      }
      
      // 4. Update the translations state
      const newTranslationsState = { ...translations };
      
      // 5. Add the key to all locales in our state
      for (const locale of availableLocales) {
        newTranslationsState[locale] = {
          ...newTranslationsState[locale],
          [newKey]: newTranslations[locale]
        };
      }
      
      setTranslations(newTranslationsState);
      setTranslationKeys([...translationKeys, newKey].sort());
      
      // Reset form
      setNewKey('');
      setNewTranslations({});
      addKeyDialogRef.current?.close();
      
      alert('New translation key added successfully!');
    } catch (error) {
      clientLogger.error('Error adding translation key:', error);
      setErrorMessage(`Error adding translation key: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new language
  const handleAddLanguage = async () => {
    if (!newLocaleCode) {
      setErrorMessage('Language code is required');
      return;
    }
    
    if (!newLocaleName) {
      setErrorMessage('Language name is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Send to API
      const response = await fetch('/api/translations/add-locale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: newLocaleCode,
          name: newLocaleName
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add language');
      }
      
      // Reload page to refresh available locales
      window.location.reload();
      
    } catch (error) {
      clientLogger.error('Error adding language:', error);
      setErrorMessage(`Error adding language: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      // Create a CSV string
      let csv = 'key';
      
      // Add header row with locale names
      for (const locale of availableLocales) {
        csv += `,${locale}`;
      }
      csv += '\n';
      
      // Add rows for each key
      for (const key of translationKeys) {
        csv += `"${key.replace(/"/g, '""')}"`;
        
        for (const locale of availableLocales) {
          const value = translations[locale]?.[key] || '';
          csv += `,"${value.replace(/"/g, '""')}"`;
        }
        
        csv += '\n';
      }
      
      // Create a Blob and download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'translations.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      clientLogger.error('Error exporting translations:', error);
      setErrorMessage(`Error exporting translations: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading && Object.keys(translations).length === 0) {
    return <div>Loading translations...</div>;
  }

  // Check if there are any unsaved changes
  const hasUnsavedChanges = Object.values(unsavedChanges).some(value => value);

  return (
    <div>
      <Tabs defaultValue="keys" value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <Button onClick={openAddLanguageDialog}>
              Add New Language
            </Button>
            <Button onClick={openAddKeyDialog}>
              Add New Translation Key
            </Button>
            <Button onClick={handleSaveAll} disabled={!hasUnsavedChanges || isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
          <div className="flex gap-2 mb-2">
            <Button onClick={openImportDialog}>
              Import from CSV
            </Button>
            <Button onClick={handleExport}>
              Export to CSV
            </Button>
          </div>
          <div className="flex gap-2">
            <TabsList>
              <TabsTrigger value="keys">By Keys</TabsTrigger>
              <TabsTrigger value="languages">By Languages</TabsTrigger>
            </TabsList>
          </div>
        </div>
        
        <Input
          className="mb-4"
          placeholder="Search translations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <TabsContent value="keys">
          <Card>
            <CardContent className="p-4">
              {/* Wrap the table in a div with styles applied directly */}
              <div style={{
                maxHeight: "600px",
                overflow: "auto",
                position: "relative"
              }}>
                <Table>
                  <TableHeader style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "white" }}>
                    <TableRow>
                      <TableHead style={{ position: "sticky", left: 0, zIndex: 20, backgroundColor: "white" }}>Key</TableHead>
                      {availableLocales.map((locale) => (
                        <TableHead key={locale}>
                          {localeNames[locale]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.map((key) => (
                      <TableRow key={key}>
                        <TableCell 
                          className="font-mono text-sm"
                          style={{ position: "sticky", left: 0, zIndex: 5, backgroundColor: "white" }}
                        >
                          {key}
                        </TableCell>
                        {availableLocales.map((locale) => (
                          <TableCell key={locale}>
                            <Textarea
                              value={translations[locale]?.[key] || ''}
                              onChange={(e) => 
                                handleTranslationChange(locale, key, e.target.value)
                              }
                              className="min-h-[40px] text-sm resize-y w-full"
                              rows={2}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="languages">
          <div className="grid grid-cols-1 gap-4">
            {availableLocales.map((locale) => (
              <Card key={locale}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{localeNames[locale]}</h3>
                    <Button 
                      onClick={() => handleSave(locale)}
                      disabled={!unsavedChanges[locale]}
                    >
                      Save Changes
                    </Button>
                  </div>
                  
                  {/* Wrap the table in a div with styles applied directly */}
                  <div style={{
                    maxHeight: "400px",
                    overflow: "auto",
                    position: "relative"
                  }}>
                    <Table>
                      <TableHeader style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "white" }}>
                        <TableRow>
                          <TableHead style={{ position: "sticky", left: 0, zIndex: 20, backgroundColor: "white" }}>Key</TableHead>
                          <TableHead>{localeNames[defaultLocale]}</TableHead>
                          <TableHead>Translation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredKeys.map((key) => (
                          <TableRow key={key}>
                            <TableCell 
                              className="font-mono text-sm"
                              style={{ position: "sticky", left: 0, zIndex: 5, backgroundColor: "white" }}
                            >
                              {key}
                            </TableCell>
                            <TableCell>{translations[defaultLocale]?.[key] || ''}</TableCell>
                            <TableCell>
                              <Textarea
                                value={translations[locale]?.[key] || ''}
                                onChange={(e) => 
                                  handleTranslationChange(locale, key, e.target.value)
                                }
                                className="min-h-[40px] text-sm resize-y w-full"
                                rows={2}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Key Dialog */}
      <dialog 
        ref={addKeyDialogRef} 
        className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-md"
      >
        <div className="bg-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Add New Translation Key</h3>
            <button 
              onClick={closeAddKeyDialog}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {errorMessage && (
            <div className="mb-4">
              <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200">
                {errorMessage}
              </div>
            </div>
          )}
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key" className="text-right">
                Key
              </Label>
              <Input
                id="key"
                className="col-span-3"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g., customer.tabs.edit"
              />
            </div>
            
            {/* Translation inputs for all locales */}
            {availableLocales.map(locale => (
              <div key={locale} className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={`translation-${locale}`} className="text-right">
                  {localeNames[locale]}
                </Label>
                <Input
                  id={`translation-${locale}`}
                  className="col-span-3"
                  value={newTranslations[locale] || ''}
                  onChange={(e) => handleNewTranslationChange(locale, e.target.value)}
                  placeholder={`Enter ${localeNames[locale]} translation`}
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeAddKeyDialog}>
              Cancel
            </Button>
            <Button onClick={handleAddKey}>
              Add Key
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
          
          {errorMessage && (
            <div className="mb-4">
              <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200">
                {errorMessage}
              </div>
            </div>
          )}
          
          <div>
            <FormTable>
              <FormRow
                label="Language Code"
                htmlFor="locale-code"
                required={true}
              >
                <Input
                  id="locale-code"
                  value={newLocaleCode}
                  onChange={(e) => setNewLocaleCode(e.target.value)}
                  placeholder="e.g., fr, de-DE, zh-CN"
                />
              </FormRow>
              
              <FormRow
                label="Language Name"
                htmlFor="locale-name"
                required={true}
              >
                <Input
                  id="locale-name"
                  value={newLocaleName}
                  onChange={(e) => setNewLocaleName(e.target.value)}
                  placeholder="e.g., French, German, Chinese"
                />
              </FormRow>
            </FormTable>
            
            <FormActions>
              <Button variant="outline" onClick={closeAddLanguageDialog}>
                Cancel
              </Button>
              <Button onClick={handleAddLanguage}>
                Add Language
              </Button>
            </FormActions>
          </div>
        </div>
      </dialog>

      {/* Import Dialog */}
      <dialog 
        ref={importDialogRef} 
        className="p-0 rounded-lg shadow-lg backdrop:bg-black backdrop:bg-opacity-50 w-full max-w-md"
      >
        <div className="bg-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Import Translations from CSV</h3>
            <button 
              onClick={() => importDialogRef.current?.close()}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <p>Upload a CSV file with translations.</p>
            <p className="text-sm text-gray-600 mt-2">
              The CSV should have a header row with 'key' as the first column followed by locale codes.
            </p>
          </div>
          
          <Input
            type="file"
            accept=".csv"
            className="mb-4"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => importDialogRef.current?.close()}>
              Cancel
            </Button>
            <Button>
              Import
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}