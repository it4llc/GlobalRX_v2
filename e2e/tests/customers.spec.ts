import { test, expect } from '../fixtures/auth';
import { Page } from '@playwright/test';

test.describe('Customer Management', () => {
  // Use authenticated page for all tests in this group
  test.use({ storageState: undefined }); // Reset storage state if needed

  test('should display customers list', async ({ authenticatedPage: page }) => {
    // Navigate to customers page
    await page.goto('/customers');

    // Wait for the customers table to load
    await page.waitForSelector('table, [role="table"], .customer-list', {
      timeout: 10000
    });

    // Verify the page title or heading
    const heading = page.locator('h1, h2').filter({ hasText: /customer/i }).first();
    await expect(heading).toBeVisible();

    // Verify table headers exist
    const headers = ['Name', 'Contact', 'Email', 'Status'];
    for (const header of headers) {
      const th = page.locator('th').filter({ hasText: header });
      await expect(th).toBeVisible();
    }
  });

  test('should create a new customer', async ({ authenticatedPage: page }) => {
    await page.goto('/customers');

    // Click Add Customer button
    await page.click('button:has-text("Add Customer"), button:has-text("New Customer")');

    // Fill in customer details
    await page.fill('input[name="name"]', 'Test Company LLC');
    await page.fill('input[name="contactName"]', 'John Doe');
    await page.fill('input[name="contactEmail"]', 'john@testcompany.com');
    await page.fill('input[name="contactPhone"]', '555-0100');
    await page.fill('textarea[name="address"], input[name="address"]', '123 Test St, Test City, TS 12345');

    // Submit the form
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create")');

    // Wait for success message or redirect
    const successMessage = page.locator('.success, .toast-success, [role="alert"]').filter({ hasText: /success/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // Verify the customer appears in the list
    await page.goto('/customers');
    const customerRow = page.locator('tr').filter({ hasText: 'Test Company LLC' });
    await expect(customerRow).toBeVisible();
  });

  test('should edit an existing customer', async ({ authenticatedPage: page }) => {
    await page.goto('/customers');

    // Find and click edit button for first customer
    const firstRow = page.locator('tbody tr').first();
    await firstRow.locator('button:has-text("Edit"), a:has-text("Edit")').click();

    // Update customer details
    const nameInput = page.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Updated Company Name');

    // Save changes
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Update")');

    // Verify success message
    const successMessage = page.locator('.success, .toast-success, [role="alert"]').filter({ hasText: /success/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('should search for customers', async ({ authenticatedPage: page }) => {
    await page.goto('/customers');

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    await searchInput.fill('test');

    // Wait for search results to update
    await page.waitForTimeout(500); // Debounce delay

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('should handle customer deletion with confirmation', async ({ authenticatedPage: page }) => {
    await page.goto('/customers');

    // Find delete button for first customer
    const firstRow = page.locator('tbody tr').first();

    // Listen for dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('delete');
      await dialog.accept();
    });

    // Click delete
    await firstRow.locator('button:has-text("Delete"), button[aria-label="Delete"]').click();

    // Verify success message
    const successMessage = page.locator('.success, .toast-success, [role="alert"]').filter({ hasText: /deleted/i });
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields when creating customer', async ({ authenticatedPage: page }) => {
    await page.goto('/customers');

    // Click Add Customer button
    await page.click('button:has-text("Add Customer"), button:has-text("New Customer")');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create")');

    // Check for validation errors
    const nameInput = page.locator('input[name="name"]');
    const validationMessage = await nameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();

    // Or check for custom error messages
    const errorMessages = page.locator('.error, .field-error, [role="alert"]').filter({ hasText: /required/i });
    const errorCount = await errorMessages.count();
    expect(errorCount).toBeGreaterThan(0);
  });
});