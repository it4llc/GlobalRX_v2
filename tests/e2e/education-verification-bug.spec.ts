// /GlobalRX_v2/tests/e2e/education-verification-bug.spec.ts

// REGRESSION TEST: End-to-end test for Education verification infinite loop bug
// This test proves the bug exists in the actual browser environment
// It will FAIL (timeout) before the fix and PASS after the fix is applied

import { test, expect } from '@playwright/test';

test.describe('Education Verification Service Selection Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting session cookie or using test login
    // This assumes there's a test user with appropriate permissions
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');

    // Navigate to customer configurations
    await page.waitForURL(/\/customer-configs/);
  });

  test('REGRESSION: Should NOT freeze browser when selecting Education verification service', async ({ page }) => {
    // Navigate to a customer's package configuration
    await page.goto('/customer-configs');

    // Click on a customer to view their packages
    await page.click('text="Test Customer"');

    // Click the "Add Package" or "New Package" button
    await page.click('button:has-text("Add Package")');

    // Wait for the dialog to open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill in package name
    await page.fill('input[name="name"]', 'Test Package with Education');

    // This is the critical moment - selecting Education verification
    // Before fix: This will cause the page to freeze/hang
    // After fix: This will work normally

    const educationCheckbox = page.locator('label:has-text("Education Verification") input[type="checkbox"]');

    // Set a reasonable timeout for this action
    await educationCheckbox.click({ timeout: 5000 });

    // If we get here without timeout, the bug is fixed
    // The scope selector should appear
    await expect(page.locator('text=/Highest Degree/')).toBeVisible({ timeout: 3000 });

    // Verify we can interact with the scope selector
    await page.click('label:has-text("All degrees post high school")');

    // Should be able to save the package
    await page.click('button:has-text("Save")');

    // Should close dialog and show success message
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('Should handle Employment verification without freezing', async ({ page }) => {
    await page.goto('/customer-configs');
    await page.click('text="Test Customer"');
    await page.click('button:has-text("Add Package")');

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.fill('input[name="name"]', 'Test Package with Employment');

    // Select Employment verification
    const employmentCheckbox = page.locator('label:has-text("Employment Verification") input[type="checkbox"]');
    await employmentCheckbox.click({ timeout: 5000 });

    // Scope selector should appear without freezing
    await expect(page.locator('text=/Most recent employment/')).toBeVisible({ timeout: 3000 });

    // Change scope option
    await page.click('label:has-text("All employments in past")');
    await page.fill('input[type="number"][value="7"]', '10');

    // Save should work
    await page.click('button:has-text("Save")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('Should handle multiple verification services simultaneously', async ({ page }) => {
    await page.goto('/customer-configs');
    await page.click('text="Test Customer"');
    await page.click('button:has-text("Add Package")');

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.fill('input[name="name"]', 'Test Package with Multiple Verifications');

    // Select both verification services
    const educationCheckbox = page.locator('label:has-text("Education Verification") input[type="checkbox"]');
    const employmentCheckbox = page.locator('label:has-text("Employment Verification") input[type="checkbox"]');

    await educationCheckbox.click({ timeout: 5000 });
    await employmentCheckbox.click({ timeout: 5000 });

    // Both scope selectors should be visible
    await expect(page.locator('text=/Highest Degree/')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=/Most recent employment/')).toBeVisible({ timeout: 3000 });

    // Should be able to save without issues
    await page.click('button:has-text("Save")');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('Performance: Selection should complete within 2 seconds', async ({ page }) => {
    await page.goto('/customer-configs');
    await page.click('text="Test Customer"');
    await page.click('button:has-text("Add Package")');

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const startTime = Date.now();

    // Select Education verification
    const educationCheckbox = page.locator('label:has-text("Education Verification") input[type="checkbox"]');
    await educationCheckbox.click();

    // Wait for scope selector to appear
    await expect(page.locator('text=/Highest Degree/')).toBeVisible();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within 2 seconds
    expect(duration).toBeLessThan(2000);
  });

  test('Should not show console errors when selecting verification services', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/customer-configs');
    await page.click('text="Test Customer"');
    await page.click('button:has-text("Add Package")');

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Select Education verification
    const educationCheckbox = page.locator('label:has-text("Education Verification") input[type="checkbox"]');
    await educationCheckbox.click();

    // Wait for scope selector
    await expect(page.locator('text=/Highest Degree/')).toBeVisible();

    // Check for React errors about maximum update depth
    const hasInfiniteLoopError = consoleErrors.some(error =>
      error.includes('Maximum update depth exceeded') ||
      error.includes('Too many re-renders')
    );

    expect(hasInfiniteLoopError).toBe(false);
  });

  test('Should handle rapid checkbox toggling without freezing', async ({ page }) => {
    await page.goto('/customer-configs');
    await page.click('text="Test Customer"');
    await page.click('button:has-text("Add Package")');

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const educationCheckbox = page.locator('label:has-text("Education Verification") input[type="checkbox"]');

    // Rapidly toggle the checkbox
    for (let i = 0; i < 5; i++) {
      await educationCheckbox.click();
      await page.waitForTimeout(100);
    }

    // Should end in checked state (odd number of clicks)
    await expect(educationCheckbox).toBeChecked();

    // Scope selector should be visible
    await expect(page.locator('text=/Highest Degree/')).toBeVisible();

    // Page should still be responsive
    await page.fill('input[name="description"]', 'Still responsive after rapid toggling');
  });
});