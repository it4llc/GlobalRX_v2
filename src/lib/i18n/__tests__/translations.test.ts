// /GlobalRX_v2/src/lib/i18n/__tests__/translations.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTranslations } from '../translations';

// Mock the dynamic imports
vi.mock('@/translations/en-US.json', () => ({
  default: {
    'module.userAdmin.title': 'User Administration',
    'module.vendorAdmin.title': 'Vendor Administration',
    'common.home': 'Home'
    // Note: module.vendorManagement.* and module.fulfillment.* are missing (BUG)
  }
}), { virtual: true });

vi.mock('@/translations/es-ES.json', () => ({
  default: {
    'module.userAdmin.title': 'Administración de Usuarios',
    'module.vendorAdmin.title': 'Administración de Proveedores',
    'common.home': 'Inicio'
    // Note: module.vendorManagement.* and module.fulfillment.* are missing (BUG)
  }
}), { virtual: true });

describe('Translation Loading Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug: Missing translation keys', () => {
    it('should return undefined for missing vendorManagement keys (CURRENT BUG)', async () => {
      const translations = await getTranslations('en-US');

      // These keys are missing in current translation files (BUG)
      expect(translations['module.vendorManagement.title']).toBeUndefined();
      expect(translations['module.vendorManagement.description']).toBeUndefined();
      expect(translations['module.vendorManagement.button']).toBeUndefined();
    });

    it('should return undefined for missing fulfillment keys (CURRENT BUG)', async () => {
      const translations = await getTranslations('en-US');

      // These keys are completely missing (BUG)
      expect(translations['module.fulfillment.title']).toBeUndefined();
      expect(translations['module.fulfillment.description']).toBeUndefined();
      expect(translations['module.fulfillment.button']).toBeUndefined();
    });

    it('should have vendorAdmin keys but not vendorManagement (inconsistency bug)', async () => {
      const translations = await getTranslations('en-US');

      // Current state: vendorAdmin exists but vendorManagement doesn't
      expect(translations['module.vendorAdmin.title']).toBe('Vendor Administration');
      expect(translations['module.vendorManagement.title']).toBeUndefined();

      // This inconsistency causes the UI to show raw keys
    });
  });

  describe('Expected behavior after fix', () => {
    it('should have all required translation keys', async () => {
      // Mock fixed translation file
      vi.doMock('@/translations/en-US.json', () => ({
        default: {
          'module.userAdmin.title': 'User Administration',
          'module.vendorAdmin.title': 'Vendor Administration', // Keep for backward compat
          'module.vendorManagement.title': 'Vendor Management', // NEW: matches code
          'module.vendorManagement.description': 'Manage vendor organizations for order fulfillment',
          'module.vendorManagement.button': 'Manage Vendors',
          'module.fulfillment.title': 'Order Fulfillment', // NEW
          'module.fulfillment.description': 'Process and manage order fulfillment', // NEW
          'module.fulfillment.button': 'View Orders', // NEW
          'common.home': 'Home'
        }
      }), { virtual: true });

      const translations = await getTranslations('en-US');

      // After fix: all keys should exist
      expect(translations['module.vendorManagement.title']).toBe('Vendor Management');
      expect(translations['module.vendorManagement.description']).toBe('Manage vendor organizations for order fulfillment');
      expect(translations['module.vendorManagement.button']).toBe('Manage Vendors');

      expect(translations['module.fulfillment.title']).toBe('Order Fulfillment');
      expect(translations['module.fulfillment.description']).toBe('Process and manage order fulfillment');
      expect(translations['module.fulfillment.button']).toBe('View Orders');

      // Backward compatibility: old keys still work
      expect(translations['module.vendorAdmin.title']).toBe('Vendor Administration');
    });
  });

  describe('Translation fallback behavior', () => {
    it('should handle missing locale by falling back to default', async () => {
      // Try to load a locale that doesn't exist
      const translations = await getTranslations('fr-FR');

      // Should fallback to en-US
      expect(translations['common.home']).toBe('Home'); // English fallback
    });

    it('should handle import errors gracefully', async () => {
      // Mock import failure
      vi.doMock('@/translations/en-US.json', () => {
        throw new Error('Failed to load translation file');
      }, { virtual: true });

      // Should return empty object on error
      const translations = await getTranslations('en-US');
      expect(translations).toEqual({});
    });
  });

  describe('Translation key validation', () => {
    it('should identify missing required keys', async () => {
      const translations = await getTranslations('en-US');

      // List of keys that MUST exist for the app to work properly
      const requiredKeys = [
        'module.vendorManagement.title',
        'module.vendorManagement.description',
        'module.vendorManagement.button',
        'module.fulfillment.title',
        'module.fulfillment.description',
        'module.fulfillment.button'
      ];

      const missingKeys = requiredKeys.filter(key => !translations[key]);

      // This will have items before fix, empty after fix
      expect(missingKeys).toEqual([
        'module.vendorManagement.title',
        'module.vendorManagement.description',
        'module.vendorManagement.button',
        'module.fulfillment.title',
        'module.fulfillment.description',
        'module.fulfillment.button'
      ]);
    });
  });

  describe('Translation consistency', () => {
    it('should have consistent module structure', async () => {
      const translations = await getTranslations('en-US');

      // Each module should have title, description, and button keys
      const modules = ['userAdmin', 'globalConfig', 'customerConfig', 'vendorManagement', 'fulfillment'];
      const requiredSuffixes = ['title', 'description', 'button'];

      const missingKeys: string[] = [];

      modules.forEach(module => {
        requiredSuffixes.forEach(suffix => {
          const key = `module.${module}.${suffix}`;
          if (!translations[key]) {
            missingKeys.push(key);
          }
        });
      });

      // Before fix: vendorManagement and fulfillment keys are missing
      // After fix: no keys should be missing
      expect(missingKeys.length).toBeGreaterThan(0); // Will be 0 after fix
    });
  });
});

describe('Translation Utility Functions', () => {
  describe('getTranslations function', () => {
    it('should cache translations to avoid redundant imports', async () => {
      // First call
      const translations1 = await getTranslations('en-US');
      // Second call - should return same object (cached)
      const translations2 = await getTranslations('en-US');

      // Should be the same object reference if cached
      expect(translations1).toBe(translations2);
    });

    it('should load different translations for different locales', async () => {
      const enTranslations = await getTranslations('en-US');
      const esTranslations = await getTranslations('es-ES');

      // Different locales should have different translations
      expect(enTranslations['common.home']).toBe('Home');
      expect(esTranslations['common.home']).toBe('Inicio');
    });
  });
});