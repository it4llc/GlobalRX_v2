// /GlobalRX_v2/src/__tests__/translation-keys.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import enUS from '@/translations/en-US.json';
import esES from '@/translations/es-ES.json';
import enGB from '@/translations/en-GB.json';
import jaJP from '@/translations/ja-JP.json';

/**
 * Tests for translation key bugs
 *
 * These tests verify that all translation keys used in the code
 * actually exist in the translation files. They will FAIL before
 * the bug fix and PASS after.
 *
 * Bug Summary:
 * - Code uses 'module.vendorManagement.title' but translation has 'module.vendorAdmin.title'
 * - Code uses 'module.fulfillment.*' keys but they don't exist in any translation file
 */

describe('Translation Keys Bug Tests', () => {
  describe('Bug: Missing translation keys that cause raw keys to display', () => {
    // These tests PROVE THE BUG EXISTS - they should FAIL before the fix

    it('should have module.vendorManagement.title key in all translation files (BUG: uses vendorAdmin instead)', () => {
      // The code in client-nav.tsx line 118 uses 'module.vendorManagement.title'
      // but the translation file has 'module.vendorAdmin.title'
      expect(enUS).toHaveProperty('module.vendorManagement.title');
      expect(esES).toHaveProperty('module.vendorManagement.title');
      expect(enGB).toHaveProperty('module.vendorManagement.title');
      expect(jaJP).toHaveProperty('module.vendorManagement.title');
    });

    it('should have module.fulfillment.title key in all translation files (BUG: completely missing)', () => {
      // The code in client-nav.tsx line 130 and homepage-content.tsx line 93 uses this key
      expect(enUS).toHaveProperty('module.fulfillment.title');
      expect(esES).toHaveProperty('module.fulfillment.title');
      expect(enGB).toHaveProperty('module.fulfillment.title');
      expect(jaJP).toHaveProperty('module.fulfillment.title');
    });

    it('should have module.fulfillment.description key in all translation files (BUG: completely missing)', () => {
      // The code in homepage-content.tsx line 94 uses this key
      expect(enUS).toHaveProperty('module.fulfillment.description');
      expect(esES).toHaveProperty('module.fulfillment.description');
      expect(enGB).toHaveProperty('module.fulfillment.description');
      expect(jaJP).toHaveProperty('module.fulfillment.description');
    });

    it('should have module.fulfillment.button key in all translation files (BUG: completely missing)', () => {
      // The code in homepage-content.tsx line 98 uses this key
      expect(enUS).toHaveProperty('module.fulfillment.button');
      expect(esES).toHaveProperty('module.fulfillment.button');
      expect(enGB).toHaveProperty('module.fulfillment.button');
      expect(jaJP).toHaveProperty('module.fulfillment.button');
    });
  });

  describe('Existing keys that should remain after fix', () => {
    // These tests ensure we don't break existing functionality

    it('should still have module.vendorAdmin keys for backward compatibility', () => {
      // Even after adding vendorManagement keys, we should keep vendorAdmin for backward compat
      expect(enUS).toHaveProperty('module.vendorAdmin.title');
      expect(enUS).toHaveProperty('module.vendorAdmin.description');
      expect(enUS).toHaveProperty('module.vendorAdmin.button');
    });

    it('should have all other module keys that are working correctly', () => {
      // Verify other module keys that are working fine
      expect(enUS).toHaveProperty('module.userAdmin.title');
      expect(enUS).toHaveProperty('module.globalConfig.title');
      expect(enUS).toHaveProperty('module.customerConfig.title');
      expect(enUS).toHaveProperty('module.candidateWorkflow.title');
    });
  });

  describe('Translation consistency across locales', () => {
    // These tests ensure all locales have the same keys

    it('should have consistent module keys across all locales', () => {
      const enUSKeys = Object.keys(enUS).filter(key => key.startsWith('module.'));
      const esESKeys = Object.keys(esES).filter(key => key.startsWith('module.'));
      const enGBKeys = Object.keys(enGB).filter(key => key.startsWith('module.'));
      const jaJPKeys = Object.keys(jaJP).filter(key => key.startsWith('module.'));

      // All locales should have the same module keys
      expect(esESKeys.sort()).toEqual(enUSKeys.sort());
      expect(enGBKeys.sort()).toEqual(enUSKeys.sort());
      expect(jaJPKeys.sort()).toEqual(enUSKeys.sort());
    });

    it('should have non-empty values for all required keys', () => {
      // After fix, these keys should have actual text values, not be empty
      const requiredKeys = [
        'module.vendorManagement.title',
        'module.vendorManagement.description',
        'module.vendorManagement.button',
        'module.fulfillment.title',
        'module.fulfillment.description',
        'module.fulfillment.button'
      ];

      requiredKeys.forEach(key => {
        // Check that values are non-empty strings
        if (enUS[key as keyof typeof enUS]) {
          expect(typeof enUS[key as keyof typeof enUS]).toBe('string');
          expect(enUS[key as keyof typeof enUS]).not.toBe('');
          expect(enUS[key as keyof typeof enUS]).not.toBe(key); // Value shouldn't be the key itself
        }
      });
    });
  });
});