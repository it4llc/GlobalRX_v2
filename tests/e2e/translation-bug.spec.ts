// /GlobalRX_v2/tests/e2e/translation-bug.spec.ts

import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for translation key bug
 *
 * These tests verify the bug where raw translation keys are displayed
 * instead of human-readable text in the navigation and homepage.
 *
 * Bug details:
 * - Navigation shows "module.vendorManagement.title" instead of "Vendor Management"
 * - Navigation shows "module.fulfillment.title" instead of "Order Fulfillment"
 * - Homepage shows raw keys for fulfillment module
 *
 * These tests will FAIL before the fix and PASS after.
 */

test.describe('Translation Key Bug Tests', () => {
  test.describe('Bug: Raw translation keys displayed in UI', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin user with full permissions
      await page.goto('/login');

      // Assuming a test admin user exists
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'Admin123!');
      await page.click('button[type="submit"]');

      // Wait for redirect to homepage
      await page.waitForURL('/');
    });

    test('should NOT display raw translation keys in navigation (CURRENT BUG)', async ({ page }) => {
      // This test proves the bug exists - it will fail before fix

      // Bug: Navigation shows raw keys
      const navBar = page.locator('nav').first();

      // These assertions will FAIL before the fix (proving the bug exists)
      // and PASS after the fix
      await expect(navBar).not.toContainText('module.vendorManagement.title');
      await expect(navBar).not.toContainText('module.fulfillment.title');

      // Instead, it should show proper text
      await expect(navBar).toContainText('Vendor Management');
      await expect(navBar).toContainText('Order Fulfillment');
    });

    test('should NOT display raw translation keys on homepage (CURRENT BUG)', async ({ page }) => {
      // This test proves the bug exists for homepage

      await page.goto('/');

      // Look for the fulfillment module card
      const fulfillmentCard = page.locator('div').filter({ hasText: /fulfillment/i }).first();

      // These assertions will FAIL before fix (proving bug exists)
      await expect(fulfillmentCard).not.toContainText('module.fulfillment.title');
      await expect(fulfillmentCard).not.toContainText('module.fulfillment.description');
      await expect(fulfillmentCard).not.toContainText('module.fulfillment.button');

      // Instead, should show proper text
      await expect(page.locator('h3')).toContainText('Order Fulfillment');
      await expect(page.locator('p')).toContainText('Process and manage order fulfillment');
      await expect(page.locator('button')).toContainText('View Orders');
    });
  });

  test.describe('Expected behavior after fix', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    });

    test('navigation should display proper translated text', async ({ page }) => {
      // After fix, all navigation items should show translated text
      const nav = page.locator('nav').first();

      // Admin navigation items
      await expect(nav.getByRole('button', { name: 'User Administration' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Global Configurations' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Customer Configurations' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Vendor Management' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Order Fulfillment' })).toBeVisible();

      // Common items
      await expect(nav.getByRole('button', { name: 'Style Guide' })).toBeVisible();
      await expect(nav.getByRole('button', { name: 'Logout' })).toBeVisible();
    });

    test('homepage modules should display proper translated text', async ({ page }) => {
      await page.goto('/');

      // Check all module cards have proper translations
      const modules = [
        { title: 'User Administration', description: 'Manage users and their permissions', button: 'Manage Users' },
        { title: 'Global Configurations', description: 'Manage locations, services, DSX, and translations', button: 'Manage Configs' },
        { title: 'Customer Configurations', description: 'Manage customer accounts and service scopes', button: 'Manage Customers' },
        { title: 'Vendor Management', description: 'Manage vendor organizations for order fulfillment', button: 'Manage Vendors' },
        { title: 'Order Fulfillment', description: 'Process and manage order fulfillment', button: 'View Orders' }
      ];

      for (const module of modules) {
        await expect(page.locator('h3', { hasText: module.title })).toBeVisible();
        await expect(page.locator('p', { hasText: module.description })).toBeVisible();
        await expect(page.locator('button', { hasText: module.button })).toBeVisible();
      }
    });
  });

  test.describe('Vendor user translation display', () => {
    test.beforeEach(async ({ page }) => {
      // Login as vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'Vendor123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    });

    test('vendor should see translated fulfillment text in navigation', async ({ page }) => {
      const nav = page.locator('nav').first();

      // Vendor should see Order Fulfillment, not raw key
      await expect(nav.getByRole('button', { name: 'Order Fulfillment' })).toBeVisible();
      await expect(nav).not.toContainText('module.fulfillment.title');

      // Vendor should NOT see admin items
      await expect(nav.getByRole('button', { name: 'User Administration' })).not.toBeVisible();
      await expect(nav.getByRole('button', { name: 'Vendor Management' })).not.toBeVisible();
    });

    test('vendor should see translated fulfillment module on homepage', async ({ page }) => {
      await page.goto('/');

      // Vendor should see fulfillment module with proper translations
      await expect(page.locator('h3', { hasText: 'Order Fulfillment' })).toBeVisible();
      await expect(page.locator('p', { hasText: 'Process and manage order fulfillment' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'View Orders' })).toBeVisible();

      // Should NOT see raw keys
      await expect(page.locator('body')).not.toContainText('module.fulfillment.title');
      await expect(page.locator('body')).not.toContainText('module.fulfillment.description');
      await expect(page.locator('body')).not.toContainText('module.fulfillment.button');
    });
  });

  test.describe('Language switching behavior', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    });

    test('should maintain proper translations when switching languages', async ({ page }) => {
      // Start in English
      const languageSelector = page.locator('[data-testid="language-selector"]');

      // Verify English translations work
      await expect(page.locator('nav')).toContainText('Order Fulfillment');
      await expect(page.locator('nav')).toContainText('Vendor Management');

      // Switch to Spanish
      await languageSelector.click();
      await page.click('button[role="option"]:has-text("Español")');

      // After fix, Spanish translations should work too
      // (Exact Spanish text depends on translation files)
      await expect(page.locator('nav')).not.toContainText('module.fulfillment.title');
      await expect(page.locator('nav')).not.toContainText('module.vendorManagement.title');

      // Switch back to English
      await languageSelector.click();
      await page.click('button[role="option"]:has-text("English")');

      // Verify English translations still work
      await expect(page.locator('nav')).toContainText('Order Fulfillment');
      await expect(page.locator('nav')).toContainText('Vendor Management');
    });
  });

  test.describe('Visual regression check', () => {
    test('navigation should not have visual artifacts from raw keys', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'Admin123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');

      // Check that raw keys don't cause layout issues
      const nav = page.locator('nav').first();

      // Raw keys like "module.vendorManagement.title" are much longer than "Vendor Management"
      // This could cause buttons to overflow or wrap incorrectly

      const vendorButton = nav.getByRole('button', { name: /vendor/i });
      const fulfillmentButton = nav.getByRole('button', { name: /fulfillment|order/i });

      // Buttons should be properly sized and aligned
      const vendorBox = await vendorButton.boundingBox();
      const fulfillmentBox = await fulfillmentButton.boundingBox();

      if (vendorBox && fulfillmentBox) {
        // Buttons should have reasonable widths (not stretched by long keys)
        expect(vendorBox.width).toBeLessThan(300); // Raw key would be much wider
        expect(fulfillmentBox.width).toBeLessThan(300);

        // Buttons should be horizontally aligned
        expect(Math.abs(vendorBox.y - fulfillmentBox.y)).toBeLessThan(5);
      }
    });
  });
});