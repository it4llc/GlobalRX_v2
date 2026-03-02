// /GlobalRX_v2/src/contexts/__tests__/TranslationContext.test.tsx

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TranslationProvider, useTranslation } from '../TranslationContext';

// Mock the translation module
vi.mock('@/lib/i18n/translations', () => ({
  getTranslations: vi.fn()
}));

vi.mock('@/lib/i18n/config', () => ({
  defaultLocale: 'en-US',
  availableLocales: ['en-US', 'es-ES', 'en-GB', 'ja-JP']
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn()
  }
}));

import { getTranslations } from '@/lib/i18n/translations';

const mockGetTranslations = vi.mocked(getTranslations);

// Test component that uses translation
function TestComponent({ translationKey }: { translationKey: string }) {
  const { t } = useTranslation();
  return <div data-testid="translation">{t(translationKey)}</div>;
}

describe('TranslationContext Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bug: Translation keys not resolving correctly', () => {
    it('should return the key itself when translation is missing (current bug behavior)', async () => {
      // Mock translations WITHOUT the problematic keys to simulate current bug
      mockGetTranslations.mockResolvedValue({
        'module.vendorAdmin.title': 'Vendor Administration',
        'common.home': 'Home'
        // Note: module.vendorManagement.title is MISSING
        // Note: module.fulfillment.* keys are MISSING
      });

      render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      // Wait for the translation to load
      await waitFor(() => {
        // Bug behavior: When key doesn't exist, it returns the key itself
        expect(screen.getByTestId('translation')).toHaveTextContent('module.vendorManagement.title');
      });
    });

    it('should return raw key for missing fulfillment translations', async () => {
      mockGetTranslations.mockResolvedValue({
        'module.vendorAdmin.title': 'Vendor Administration',
        'common.home': 'Home'
        // module.fulfillment keys are completely missing
      });

      const { rerender } = render(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('module.fulfillment.title');
      });

      // Test other missing fulfillment keys
      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.description" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('module.fulfillment.description');
      });

      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.button" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('module.fulfillment.button');
      });
    });
  });

  describe('Expected behavior after fix', () => {
    it('should return proper translation when keys are correctly mapped', async () => {
      // Mock translations WITH the correct keys (after fix)
      mockGetTranslations.mockResolvedValue({
        'module.vendorManagement.title': 'Vendor Management',
        'module.vendorManagement.description': 'Manage vendor organizations for order fulfillment',
        'module.vendorManagement.button': 'Manage Vendors',
        'module.fulfillment.title': 'Order Fulfillment',
        'module.fulfillment.description': 'Process and manage order fulfillment',
        'module.fulfillment.button': 'View Orders',
        'module.vendorAdmin.title': 'Vendor Administration', // Keep for backward compat
        'common.home': 'Home'
      });

      const { rerender } = render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('Vendor Management');
      });

      // Test fulfillment translations
      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('Order Fulfillment');
      });

      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.description" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('Process and manage order fulfillment');
      });
    });

    it('should maintain backward compatibility with vendorAdmin keys', async () => {
      mockGetTranslations.mockResolvedValue({
        'module.vendorManagement.title': 'Vendor Management',
        'module.vendorAdmin.title': 'Vendor Administration', // Both should exist
        'module.fulfillment.title': 'Order Fulfillment'
      });

      const { rerender } = render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorAdmin.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        // Old key should still work
        expect(screen.getByTestId('translation')).toHaveTextContent('Vendor Administration');
      });

      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        // New key should also work
        expect(screen.getByTestId('translation')).toHaveTextContent('Vendor Management');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string translations gracefully', async () => {
      mockGetTranslations.mockResolvedValue({
        'module.vendorManagement.title': '', // Empty string
        'module.fulfillment.title': '   ' // Whitespace only
      });

      const { rerender } = render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        // Should return key when value is empty
        expect(screen.getByTestId('translation')).toHaveTextContent('module.vendorManagement.title');
      });

      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        // Should return key when value is whitespace
        expect(screen.getByTestId('translation')).toHaveTextContent('module.fulfillment.title');
      });
    });

    it('should handle null or undefined gracefully', async () => {
      mockGetTranslations.mockResolvedValue({
        'module.vendorManagement.title': null as any,
        'module.fulfillment.title': undefined as any
      });

      const { rerender } = render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('module.vendorManagement.title');
      });

      rerender(
        <TranslationProvider>
          <TestComponent translationKey="module.fulfillment.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('translation')).toHaveTextContent('module.fulfillment.title');
      });
    });

    it('should handle translation loading errors gracefully', async () => {
      mockGetTranslations.mockRejectedValue(new Error('Failed to load translations'));

      render(
        <TranslationProvider>
          <TestComponent translationKey="module.vendorManagement.title" />
        </TranslationProvider>
      );

      await waitFor(() => {
        // Should return key when translations fail to load
        expect(screen.getByTestId('translation')).toHaveTextContent('module.vendorManagement.title');
      });
    });
  });
});