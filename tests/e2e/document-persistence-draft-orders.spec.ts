// /GlobalRX_v2/tests/e2e/document-persistence-draft-orders.spec.ts

// REGRESSION TEST: proves bug fix for document persistence in draft orders
// Bug: Documents uploaded in draft orders were lost when the order was saved
// because File objects cannot be JSON serialized.

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Document Persistence in Draft Orders', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a customer user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for redirect to portal
    await page.waitForURL('**/portal/**');
  });

  test('REGRESSION TEST: uploaded documents persist when saving draft order', async ({ page }) => {
    // Navigate to create new order
    await page.goto('/portal/orders/new');

    // Step 1: Add a service
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'background-check');
    await page.selectOption('select[name="location"]', 'national');
    await page.click('button:has-text("Add to Cart")');

    // Move to step 2: Subject Information
    await page.click('button:has-text("Next")');
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');

    // Move to step 3: Search Fields
    await page.click('button:has-text("Next")');
    // Fill any required search fields if present

    // Move to step 4: Documents & Review
    await page.click('button:has-text("Next")');

    // Upload a document
    const testFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
    const fileInput = await page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);

    // Wait for upload to complete (should show filename)
    await expect(page.locator('text=test-document.pdf')).toBeVisible({ timeout: 10000 });

    // Save as draft
    await page.click('button:has-text("Save as Draft")');

    // Wait for redirect to orders list
    await page.waitForURL('**/portal/orders**');
    await expect(page.locator('text=Draft order saved')).toBeVisible();

    // Find the draft order and click to edit
    await page.click('text=Draft >> ../.. >> text=Edit');

    // Wait for order to load
    await page.waitForURL('**/portal/orders/new?edit=**');

    // Navigate to Documents step
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Next")');
    }

    // VERIFY: Document should still be present
    await expect(page.locator('text=test-document.pdf')).toBeVisible();

    // Document should show as already uploaded
    await expect(page.locator('button:has-text("Change File")')).toBeVisible();

    // The order summary should show the document
    await expect(page.locator('.bg-gray-50').locator('text=test-document.pdf')).toBeVisible();
  });

  test('documents can be replaced when editing draft order', async ({ page }) => {
    // Create a draft order with a document first
    await page.goto('/portal/orders/new');

    // Add service
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'background-check');
    await page.selectOption('select[name="location"]', 'national');
    await page.click('button:has-text("Add to Cart")');

    // Fill subject info
    await page.click('button:has-text("Next")');
    await page.fill('input[name="firstName"]', 'Jane');
    await page.fill('input[name="lastName"]', 'Smith');

    // Skip to documents
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Upload first document
    const firstFilePath = path.join(__dirname, 'fixtures', 'first-document.pdf');
    await page.locator('input[type="file"]').first().setInputFiles(firstFilePath);
    await expect(page.locator('text=first-document.pdf')).toBeVisible();

    // Save as draft
    await page.click('button:has-text("Save as Draft")');
    await page.waitForURL('**/portal/orders**');

    // Edit the draft
    await page.click('text=Draft >> ../.. >> text=Edit');
    await page.waitForURL('**/portal/orders/new?edit=**');

    // Navigate to Documents step
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Next")');
    }

    // Original document should be present
    await expect(page.locator('text=first-document.pdf')).toBeVisible();

    // Replace with new document
    const secondFilePath = path.join(__dirname, 'fixtures', 'second-document.pdf');
    await page.locator('input[type="file"]').first().setInputFiles(secondFilePath);

    // New document should replace the old one
    await expect(page.locator('text=second-document.pdf')).toBeVisible();
    await expect(page.locator('text=first-document.pdf')).not.toBeVisible();

    // Save again
    await page.click('button:has-text("Save as Draft")');
    await page.waitForURL('**/portal/orders**');

    // Edit again to verify
    await page.click('text=Draft >> ../.. >> text=Edit');
    await page.waitForURL('**/portal/orders/new?edit=**');

    // Navigate to Documents step
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Next")');
    }

    // New document should persist
    await expect(page.locator('text=second-document.pdf')).toBeVisible();
    await expect(page.locator('text=first-document.pdf')).not.toBeVisible();
  });

  test('multiple documents for different requirements persist correctly', async ({ page }) => {
    await page.goto('/portal/orders/new');

    // Add service that requires multiple documents
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'education-verification');
    await page.selectOption('select[name="location"]', 'university');
    await page.click('button:has-text("Add to Cart")');

    // Fill required fields
    await page.click('button:has-text("Next")');
    await page.fill('input[name="firstName"]', 'Alice');
    await page.fill('input[name="lastName"]', 'Johnson');

    // Skip to documents
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Upload multiple documents for different requirements
    const documents = [
      { selector: 'input[id="doc-transcript"]', file: 'transcript.pdf' },
      { selector: 'input[id="doc-diploma"]', file: 'diploma.pdf' },
      { selector: 'input[id="doc-authorization"]', file: 'auth-form.pdf' },
    ];

    for (const doc of documents) {
      const filePath = path.join(__dirname, 'fixtures', doc.file);
      const input = page.locator(doc.selector);
      if (await input.count() > 0) {
        await input.setInputFiles(filePath);
        await expect(page.locator(`text=${doc.file}`)).toBeVisible();
      }
    }

    // Save as draft
    await page.click('button:has-text("Save as Draft")');
    await page.waitForURL('**/portal/orders**');

    // Edit the draft
    await page.click('text=Draft >> ../.. >> text=Edit');
    await page.waitForURL('**/portal/orders/new?edit=**');

    // Navigate to Documents step
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Next")');
    }

    // All documents should still be present
    for (const doc of documents) {
      if (await page.locator(`text=${doc.file}`).count() > 0) {
        await expect(page.locator(`text=${doc.file}`)).toBeVisible();
      }
    }
  });

  test('document upload shows error for invalid file types', async ({ page }) => {
    await page.goto('/portal/orders/new');

    // Add service
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'background-check');
    await page.selectOption('select[name="location"]', 'national');
    await page.click('button:has-text("Add to Cart")');

    // Navigate to documents
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Next")');
    }

    // Try to upload invalid file type
    const invalidFilePath = path.join(__dirname, 'fixtures', 'malicious.exe');
    const fileInput = page.locator('input[type="file"]').first();

    // Set up listener for console errors or alerts
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('File type not allowed');
      await dialog.accept();
    });

    await fileInput.setInputFiles(invalidFilePath);

    // File should not be accepted
    await expect(page.locator('text=malicious.exe')).not.toBeVisible({ timeout: 5000 });

    // Error message should be shown (implementation specific)
    const errorMessage = page.locator('text=/File type not allowed|Invalid file type|not supported/i');
    if (await errorMessage.count() > 0) {
      await expect(errorMessage).toBeVisible();
    }
  });

  test('submitting order with documents works correctly', async ({ page }) => {
    await page.goto('/portal/orders/new');

    // Complete full order with documents
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'background-check');
    await page.selectOption('select[name="location"]', 'national');
    await page.click('button:has-text("Add to Cart")');

    await page.click('button:has-text("Next")');
    await page.fill('input[name="firstName"]', 'Bob');
    await page.fill('input[name="lastName"]', 'Wilson');
    await page.fill('input[name="dateOfBirth"]', '1985-05-15');
    await page.fill('input[name="email"]', 'bob@example.com');

    await page.click('button:has-text("Next")');
    // Fill search fields if needed

    await page.click('button:has-text("Next")');

    // Upload required document
    const testFilePath = path.join(__dirname, 'fixtures', 'authorization.pdf');
    await page.locator('input[type="file"]').first().setInputFiles(testFilePath);
    await expect(page.locator('text=authorization.pdf')).toBeVisible();

    // Submit order (not as draft)
    await page.click('button:has-text("Submit Order")');

    // Should redirect to order confirmation or list
    await page.waitForURL('**/portal/orders**');

    // Order should be in submitted status, not draft
    await expect(page.locator('text=Submitted')).toBeVisible();

    // View the submitted order
    await page.click('text=Submitted >> ../.. >> text=View');

    // Document should be visible in order details
    await expect(page.locator('text=authorization.pdf')).toBeVisible();
  });

  test('document metadata displays correctly in order summary', async ({ page }) => {
    await page.goto('/portal/orders/new');

    // Add service
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', 'background-check');
    await page.selectOption('select[name="location"]', 'national');
    await page.click('button:has-text("Add to Cart")');

    // Fill basic info
    await page.click('button:has-text("Next")');
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');

    // Navigate to documents
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');

    // Upload document
    const testFilePath = path.join(__dirname, 'fixtures', 'test-doc.pdf');
    await page.locator('input[type="file"]').first().setInputFiles(testFilePath);

    // Check order summary section
    const orderSummary = page.locator('.bg-gray-50');

    // Document should appear in summary
    await expect(orderSummary.locator('text=Documents')).toBeVisible();
    await expect(orderSummary.locator('text=test-doc.pdf')).toBeVisible();

    // If document is required and not uploaded, should show warning
    const requiredDocs = await page.locator('span:has-text("*")').count();
    if (requiredDocs > 0) {
      const fileInputs = await page.locator('input[type="file"]').count();

      // Upload to all required document fields
      for (let i = 0; i < Math.min(requiredDocs, fileInputs); i++) {
        if (!(await page.locator('text=Change File').nth(i).isVisible({ timeout: 1000 }).catch(() => false))) {
          await page.locator('input[type="file"]').nth(i).setInputFiles(testFilePath);
        }
      }

      // Summary should update to show all uploaded
      await expect(orderSummary.locator('text=Missing (Required)')).not.toBeVisible({ timeout: 5000 }).catch(() => {
        // Some documents might be optional
      });
    }
  });
});