// /GlobalRX_v2/tests/e2e/customer-status-color-bug.spec.ts
// REGRESSION TEST: proves bug fix for missing customer status color coding

import { test, expect } from '@playwright/test';

test.describe('Customer Order Status Color Coding - Bug Fix Regression Tests', () => {

  // REGRESSION TEST: proves bug fix for missing customer status color coding
  test('customer sees order status with proper color coding', async ({ page }) => {
    // This test asserts the CORRECT behavior (color-coded status for customers)
    // It will FAIL before the fix (status appears without color classes)
    // It will PASS after the fix (status appears with color classes)

    // Step 1: Login as customer
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Step 2: Navigate to order details with "processing" status
    await page.goto('/fulfillment/orders/order-processing');

    // Step 3: Verify status is visible
    const statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();

    // Step 4: Assert CORRECT behavior - status should have color classes
    // Processing status should have green color classes (bg-green-50, text-green-600, border-green-300)
    // This assertion will FAIL before the fix and PASS after the fix
    await expect(statusElement).toHaveClass(/bg-green-50/);
    await expect(statusElement).toHaveClass(/text-green-600/);
    await expect(statusElement).toHaveClass(/border-green-300/);
  });

  test('customer sees different status values with appropriate color coding', async ({ page }) => {
    // Additional test to verify all status colors work for customers

    // Login as customer
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Test draft status (gray color)
    await page.goto('/fulfillment/orders/order-draft');
    let statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toHaveClass(/bg-gray-100/);
    await expect(statusElement).toHaveClass(/text-gray-800/);
    await expect(statusElement).toHaveClass(/border-gray-300/);

    // Test submitted status (blue color)
    await page.goto('/fulfillment/orders/order-submitted');
    statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toHaveClass(/bg-blue-100/);
    await expect(statusElement).toHaveClass(/text-blue-800/);
    await expect(statusElement).toHaveClass(/border-blue-300/);

    // Test completed status (green color)
    await page.goto('/fulfillment/orders/order-completed');
    statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toHaveClass(/bg-green-200/);
    await expect(statusElement).toHaveClass(/text-green-900/);
    await expect(statusElement).toHaveClass(/border-green-500/);

    // Test missing_info status (red color)
    await page.goto('/fulfillment/orders/order-missing-info');
    statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toHaveClass(/bg-red-100/);
    await expect(statusElement).toHaveClass(/text-red-800/);
    await expect(statusElement).toHaveClass(/border-red-300/);

    // Test cancelled status (purple color)
    await page.goto('/fulfillment/orders/order-cancelled');
    statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();
    await expect(statusElement).toHaveClass(/bg-purple-100/);
    await expect(statusElement).toHaveClass(/text-purple-800/);
    await expect(statusElement).toHaveClass(/border-purple-300/);
  });

  test('internal users still see status dropdown with color coding', async ({ page }) => {
    // Happy path test to ensure internal users are not affected by the fix

    // Login as internal user with fulfillment permission
    await page.goto('/login');
    await page.fill('input[name="email"]', 'internal@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order details
    await page.goto('/fulfillment/orders/order-processing');

    // Internal users should see a dropdown (not plain text)
    const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
    await expect(statusDropdown).toBeVisible();

    // The dropdown should also have color coding
    await expect(statusDropdown).toHaveClass(/bg-green-50/);
    await expect(statusDropdown).toHaveClass(/text-green-600/);
    await expect(statusDropdown).toHaveClass(/border-green-300/);
  });

  test('customer status display matches the normalized status value', async ({ page }) => {
    // Edge case test: ensure status normalization works correctly

    // Login as customer
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Test cancelled_dnb status (special case with underscore)
    await page.goto('/fulfillment/orders/order-cancelled-dnb');
    const statusElement = page.locator('[data-testid="order-status-text"], .order-status').first();
    await expect(statusElement).toBeVisible();

    // Should display as "Cancelled-DNB" but with purple color classes
    await expect(statusElement).toContainText('Cancelled-DNB');
    await expect(statusElement).toHaveClass(/bg-purple-100/);
    await expect(statusElement).toHaveClass(/text-purple-800/);
    await expect(statusElement).toHaveClass(/border-purple-300/);
  });

});