// /GlobalRX_v2/tests/e2e/pdf-template-download.spec.ts
// End-to-end tests for PDF template download feature

import { test, expect } from '@playwright/test';

test.describe('PDF Template Download Feature - E2E Tests', () => {

  test.describe('Customer User Journey - New Order', () => {
    test('customer can download PDF templates while creating new order', async ({ page }) => {
      // Step 1: Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to new order page
      await page.waitForURL(/\/portal|\/dashboard/);
      await page.click('text=Create New Order');
      await page.waitForURL('/portal/orders/new');

      // Step 3: Complete Steps 1-3 to reach Documents step
      // Step 1: Service Selection
      await page.click('input[type="checkbox"][value="background-check"]');
      await page.click('button:has-text("Next")');

      // Step 2: Subject Info
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.fill('input[name="email"]', 'john.doe@example.com');
      await page.fill('input[name="phone"]', '555-0123');
      await page.click('button:has-text("Next")');

      // Step 3: Search Details
      await page.fill('input[name="ssn"]', '123-45-6789');
      await page.fill('input[name="dateOfBirth"]', '01/01/1990');
      await page.click('button:has-text("Next")');

      // Step 4: Documents & Review - where download buttons appear
      await expect(page.getByText('Documents & Review')).toBeVisible();

      // Verify download button appears for documents with templates
      const downloadButton = page.getByRole('button', { name: /Download Form.*2\.3 MB/i });
      await expect(downloadButton).toBeVisible();

      // Verify download icon is present
      const buttonWithIcon = page.locator('button:has(svg)').filter({ hasText: 'Download Form' });
      await expect(buttonWithIcon).toBeVisible();

      // Verify no download button for documents without templates
      const documentWithoutTemplate = page.locator('.document-row').filter({ hasText: 'Background Check Consent' });
      await expect(documentWithoutTemplate).toBeVisible();
      await expect(documentWithoutTemplate.locator('button:has-text("Download Form")')).not.toBeVisible();
    });

    test('customer can download multiple templates for different documents', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Find all download buttons
      const downloadButtons = page.locator('button:has-text("Download Form")');
      const count = await downloadButtons.count();

      // Should have multiple download buttons if multiple documents have templates
      expect(count).toBeGreaterThan(0);

      // Each button should show file size
      for (let i = 0; i < count; i++) {
        const button = downloadButtons.nth(i);
        const buttonText = await button.textContent();
        expect(buttonText).toMatch(/Download Form.*\d+\.\d+ MB/);
      }
    });

    test('download button triggers PDF download with correct filename', async ({ page, context }) => {
      // Set up download handling
      const downloadPromise = page.waitForEvent('download');

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Click download button
      await page.click('button:has-text("Download Form")');

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download has correct filename
      const suggestedFilename = download.suggestedFilename();
      expect(suggestedFilename).toMatch(/\.pdf$/);
      expect(suggestedFilename).not.toBe('document.pdf'); // Should have specific name

      // Verify download completes successfully
      const path = await download.path();
      expect(path).toBeTruthy();
    });

    test('download button shows loading state during download', async ({ page }) => {
      // Mock slow network
      await page.route('**/api/portal/documents/*/download-template', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('PDF content'),
          headers: {
            'Content-Disposition': 'attachment; filename="test-form.pdf"'
          }
        });
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      const downloadButton = page.getByRole('button', { name: /Download Form/i }).first();

      // Click download button
      await downloadButton.click();

      // Should show loading state
      await expect(downloadButton).toContainText('Downloading...');
      await expect(downloadButton).toBeDisabled();

      // Should return to normal state after download
      await expect(downloadButton).toContainText('Download Form');
      await expect(downloadButton).toBeEnabled();
    });
  });

  test.describe('Customer User Journey - Edit Draft Order', () => {
    test('customer can download templates when editing draft order', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to draft order edit page
      await page.goto('/portal/orders/draft-order-123/edit');

      // Navigate to step 4
      await page.click('text=Documents & Review');

      // Verify download buttons are available
      const downloadButton = page.getByRole('button', { name: /Download Form/i });
      await expect(downloadButton).toBeVisible();

      // Click download should work
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.first().click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('shows error message when template file is missing', async ({ page }) => {
      // Mock API to return 404
      await page.route('**/api/portal/documents/*/download-template', route => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Template file not found. Please contact support.' })
        });
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Set up dialog handler for alert
      page.on('dialog', dialog => {
        expect(dialog.message()).toContain('Template file not found');
        dialog.accept();
      });

      // Click download button
      await page.click('button:has-text("Download Form")');

      // Button should return to enabled state
      const downloadButton = page.getByRole('button', { name: /Download Form/i }).first();
      await expect(downloadButton).toBeEnabled();
    });

    test('shows error when user session expires during download', async ({ page }) => {
      // Mock API to return 401
      await page.route('**/api/portal/documents/*/download-template', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Click download button
      await page.click('button:has-text("Download Form")');

      // Should redirect to login or show error
      await expect(page).toHaveURL(/login/, { timeout: 5000 });
    });

    test('handles network failure gracefully', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/portal/documents/*/download-template', route => {
        route.abort('failed');
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Set up dialog handler for alert
      page.on('dialog', dialog => {
        expect(dialog.message()).toContain('Failed to download');
        dialog.accept();
      });

      // Click download button
      await page.click('button:has-text("Download Form")');

      // Button should return to enabled state
      const downloadButton = page.getByRole('button', { name: /Download Form/i }).first();
      await expect(downloadButton).toBeEnabled();
    });
  });

  test.describe('UI Behavior', () => {
    test('download button is positioned to the right of document instructions', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Find a document row with a download button
      const documentRow = page.locator('.document-row').filter({ has: page.getByRole('button', { name: /Download Form/i }) }).first();

      // Get bounding boxes
      const instructionsBox = await documentRow.locator('.document-instructions').boundingBox();
      const buttonBox = await documentRow.locator('button:has-text("Download Form")').boundingBox();

      // Button should be to the right of instructions
      expect(buttonBox?.x).toBeGreaterThan(instructionsBox?.x || 0);
    });

    test('file size is displayed in human-readable format', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Check file size display formats
      const buttons = page.locator('button:has-text("Download Form")');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const buttonText = await buttons.nth(i).textContent();
        // Should show size in MB format
        expect(buttonText).toMatch(/\(\d+\.\d+ MB\)/);
      }
    });

    test('no visual indicator appears for documents without templates', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Find documents without templates
      const allDocuments = page.locator('.document-row');
      const documentsCount = await allDocuments.count();

      for (let i = 0; i < documentsCount; i++) {
        const doc = allDocuments.nth(i);
        const hasDownloadButton = await doc.locator('button:has-text("Download Form")').count() > 0;

        if (!hasDownloadButton) {
          // Should not have any template-related indicators
          await expect(doc.locator('text=No template')).not.toBeVisible();
          await expect(doc.locator('text=Template unavailable')).not.toBeVisible();
          await expect(doc.locator('.template-placeholder')).not.toBeVisible();
        }
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('download button works on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Download button should be visible and clickable
      const downloadButton = page.getByRole('button', { name: /Download Form/i }).first();
      await expect(downloadButton).toBeVisible();

      // Set up download handling
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('file size text remains readable on small screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Check that file size is still visible
      const downloadButton = page.getByRole('button', { name: /Download Form.*MB/i }).first();
      await expect(downloadButton).toBeVisible();

      const buttonText = await downloadButton.textContent();
      expect(buttonText).toMatch(/\d+\.\d+ MB/);
    });
  });

  test.describe('Accessibility', () => {
    test('download button is keyboard accessible', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      // Tab to the download button
      await page.keyboard.press('Tab');

      // Keep tabbing until we reach a download button
      let focused = await page.evaluate(() => document.activeElement?.textContent);
      let tabCount = 0;
      while (focused && !focused.includes('Download Form') && tabCount < 50) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => document.activeElement?.textContent);
        tabCount++;
      }

      // Verify we reached a download button
      expect(focused).toContain('Download Form');

      // Press Enter to trigger download
      const downloadPromise = page.waitForEvent('download');
      await page.keyboard.press('Enter');
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('download button has proper ARIA attributes', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order creation step 4
      await page.goto('/portal/orders/new?step=4');

      const downloadButton = page.getByRole('button', { name: /Download Form/i }).first();

      // Check ARIA attributes
      await expect(downloadButton).toHaveAttribute('type', 'button');
      await expect(downloadButton).toHaveAccessibleName();

      // When disabled during download
      await downloadButton.click();
      await expect(downloadButton).toHaveAttribute('aria-busy', 'true');
    });
  });
});