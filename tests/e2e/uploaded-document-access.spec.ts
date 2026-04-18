// /GlobalRX_v2/tests/e2e/uploaded-document-access.spec.ts
// End-to-end tests for uploaded document access feature

import { test, expect } from '@playwright/test';

test.describe('Uploaded Document Access Feature', () => {

  test.describe('Customer User Journey', () => {
    test('customer can download documents from order details page', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // User Flow Step 1: Navigate to the order details page
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/portal|\/dashboard/);

      // Navigate to orders list
      await page.click('text=My Orders');
      await page.waitForURL('/portal/orders');

      // Click on a specific order to view details
      const orderRow = page.locator('tr').filter({ hasText: 'ORD-2024-001' }).first();
      await orderRow.click();
      await page.waitForURL(/\/portal\/orders\/[^\/]+$/);

      // User Flow Step 2: Expand an order item row to see its details
      const orderItemRow = page.locator('[data-testid="order-item-row"]').filter({ hasText: 'Background Check' }).first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // User Flow Step 3: In the "Submitted Information" section, document fields show the filename as blue underlined text
      const submittedInfoSection = page.locator('[data-testid="submitted-information"]');
      await expect(submittedInfoSection).toBeVisible();

      // Business Rule 1: Document filenames must be displayed as clickable links with visual styling
      const documentLink = submittedInfoSection.locator('a').filter({ hasText: 'consent-form.pdf' }).first();
      await expect(documentLink).toBeVisible();
      await expect(documentLink).toHaveCSS('color', 'rgb(37, 99, 235)'); // blue-600

      // User Flow Step 4: Hover over a document filename and see cursor change
      await documentLink.hover();
      await expect(documentLink).toHaveCSS('text-decoration-line', 'underline');
      await expect(documentLink).toHaveCSS('cursor', 'pointer');

      // Business Rule 8: Document links must include file size in parentheses
      const linkText = await documentLink.textContent();
      expect(linkText).toMatch(/consent-form\.pdf\s*\(271 KB\)/);

      // User Flow Step 5: Click on a document filename
      const downloadPromise = page.waitForEvent('download');
      await documentLink.click();

      // User Flow Step 6: PDF opens in new browser tab
      // Business Rule 3: Clicking a document opens in new tab for viewable types
      await expect(documentLink).toHaveAttribute('target', '_blank');
      await expect(documentLink).toHaveAttribute('rel', 'noopener noreferrer');

      // Verify download starts
      const download = await downloadPromise;
      expect(download).toBeTruthy();
      expect(download.suggestedFilename()).toBe('consent-form.pdf');
    });

    test('customer sees error message when document file is missing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Setup: Mock API to return 404 for missing document
      await page.route('**/api/portal/documents/*', route => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Document not available' })
        });
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/portal/orders/test-order-123');

      // Expand order item
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Click on document link
      const documentLink = page.locator('a').filter({ hasText: '.pdf' }).first();
      await documentLink.click();

      // User Flow Step 8: If document cannot be found, error toast appears
      // Business Rule 6: If document is missing, display error instead of breaking UI
      const toast = page.locator('[role="alert"]').filter({ hasText: 'Document not available' });
      await expect(toast).toBeVisible();

      // User remains on same page
      await expect(page).toHaveURL(/\/portal\/orders\/test-order-123/);
    });

    test('customer cannot download documents from other customers orders', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule 2: Access control follows existing view permissions
      // Setup: Mock API to return 403 for unauthorized access
      await page.route('**/api/portal/documents/*', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' })
        });
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to navigate to another customer's order (should be blocked at page level)
      await page.goto('/portal/orders/other-customer-order-456');

      // Should redirect to orders list or show error
      await expect(page).toHaveURL(/\/portal\/orders$/);
    });
  });

  test.describe('Internal Admin Journey', () => {
    test('admin can download documents from fulfillment page', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // User Flow Step 1: Navigate to fulfillment page
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find and expand a service
      const serviceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      // Wait for service details to load
      await page.waitForSelector('[data-testid="service-details"]');

      // User Flow Step 2: Expand order item to see details
      // User Flow Step 3: Document filenames appear as blue clickable links
      const documentLink = page.locator('a').filter({ hasText: 'transcript.pdf' }).first();
      await expect(documentLink).toBeVisible();
      await expect(documentLink).toHaveCSS('color', 'rgb(37, 99, 235)'); // blue-600

      // Business Rule 8: File size in parentheses
      const linkText = await documentLink.textContent();
      expect(linkText).toMatch(/transcript\.pdf\s*\(\d+(\.\d+)?\s*(KB|MB)\)/);

      // Click to download
      const downloadPromise = page.waitForEvent('download');
      await documentLink.click();

      // Business Rule 4: Documents from order_data accessible via storagePath
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('admin can download multiple document types', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Login as admin
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Navigate to service details
      const serviceRow = page.locator('tr').filter({ hasText: 'Background Check' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      // Business Rule 7: Download functionality must work for all accepted file types

      // Test PDF download
      const pdfLink = page.locator('a').filter({ hasText: '.pdf' }).first();
      await expect(pdfLink).toBeVisible();
      let downloadPromise = page.waitForEvent('download');
      await pdfLink.click();
      let download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);

      // Test image download (JPG)
      const jpgLink = page.locator('a').filter({ hasText: '.jpg' }).first();
      if (await jpgLink.count() > 0) {
        downloadPromise = page.waitForEvent('download');
        await jpgLink.click();
        download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.jpg$/);
      }

      // Test image download (PNG)
      const pngLink = page.locator('a').filter({ hasText: '.png' }).first();
      if (await pngLink.count() > 0) {
        downloadPromise = page.waitForEvent('download');
        await pngLink.click();
        download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.png$/);
      }
    });
  });

  test.describe('Vendor User Journey', () => {
    test('vendor can download documents for assigned services', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/vendor/services');

      // Find an assigned service
      const serviceRow = page.locator('tr').filter({ hasText: 'Employment Verification' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      // Document link should be visible and clickable
      const documentLink = page.locator('a').filter({ hasText: 'employment-form.pdf' }).first();
      await expect(documentLink).toBeVisible();

      // Business Rule 8: File size included
      const linkText = await documentLink.textContent();
      expect(linkText).toMatch(/employment-form\.pdf\s*\(\d+(\.\d+)?\s*(KB|MB)\)/);

      // Download document
      const downloadPromise = page.waitForEvent('download');
      await documentLink.click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('vendor cannot download documents for unassigned services', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule 2: Access control follows existing permissions
      // Setup: Mock API to return 403 for unassigned service
      await page.route('**/api/vendor/documents/*', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service not assigned to vendor' })
        });
      });

      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to access unassigned service (should be blocked at API level)
      await page.goto('/vendor/services/unassigned-service-123');

      // Should show error or redirect
      await expect(page).toHaveURL(/\/vendor\/services$/);
    });
  });

  test.describe('Document Types and Edge Cases', () => {
    test('handles documents with special characters in filename', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with special filename
      await page.goto('/portal/orders/special-chars-order');

      // Expand order item
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Document with special characters should be clickable
      const specialLink = page.locator('a').filter({ hasText: 'my file (2024) & notes.pdf' }).first();
      await expect(specialLink).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await specialLink.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('my file (2024) & notes.pdf');
    });

    test('shows plain text when storage path is null', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule Edge Case 5: Storage path null/empty renders as plain text
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with null storage path document
      await page.goto('/portal/orders/null-storage-order');

      // Expand order item
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Document should appear as plain text, not a link
      const submittedInfo = page.locator('[data-testid="submitted-information"]');
      await expect(submittedInfo).toContainText('broken-document.pdf');

      // Should not be a link
      const link = submittedInfo.locator('a').filter({ hasText: 'broken-document.pdf' });
      await expect(link).not.toBeVisible();
    });

    test('handles service_attachments documents from fulfillment', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule 5: Documents from service_attachments accessible via existing API
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find service with attachments
      const serviceRow = page.locator('tr').filter({ hasText: 'Criminal Background' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      // Look for attachment added during fulfillment
      const attachmentLink = page.locator('a').filter({ hasText: 'court-records.pdf' }).first();
      await expect(attachmentLink).toBeVisible();

      // Should use different API endpoint for attachments
      const downloadPromise = page.waitForEvent('download');
      await attachmentLink.click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });
  });

  test.describe('UI Behavior and Styling', () => {
    test('document links have correct visual styling', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule 1: Blue text color, underline on hover
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/test-order-123');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      const documentLink = page.locator('a').filter({ hasText: '.pdf' }).first();

      // Check initial state - blue text
      await expect(documentLink).toHaveCSS('color', 'rgb(37, 99, 235)'); // text-blue-600

      // Check hover state - underlined
      await documentLink.hover();
      await expect(documentLink).toHaveCSS('text-decoration-line', 'underline');
      await expect(documentLink).toHaveCSS('cursor', 'pointer');

      // Check link attributes
      await expect(documentLink).toHaveAttribute('target', '_blank');
      await expect(documentLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('file sizes display in human-readable format', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Business Rule 8: File size in parentheses
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/various-sizes-order');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Check KB format for small files
      const smallFile = page.locator('a').filter({ hasText: 'small.pdf' }).first();
      const smallText = await smallFile.textContent();
      expect(smallText).toMatch(/small\.pdf\s*\(\d+(\.\d+)?\s*KB\)/);

      // Check MB format for large files
      const largeFile = page.locator('a').filter({ hasText: 'large.pdf' }).first();
      const largeText = await largeFile.textContent();
      expect(largeText).toMatch(/large\.pdf\s*\(\d+(\.\d+)?\s*MB\)/);
    });

    test('document links are keyboard accessible', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/test-order-123');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Tab to document link
      await page.keyboard.press('Tab');

      // Keep tabbing until we reach a document link
      let focused = await page.evaluate(() => document.activeElement?.textContent);
      let tabCount = 0;
      while (focused && !focused.includes('.pdf') && tabCount < 50) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => document.activeElement?.textContent);
        tabCount++;
      }

      // Verify we reached a document link
      expect(focused).toContain('.pdf');

      // Press Enter to trigger download
      const downloadPromise = page.waitForEvent('download');
      await page.keyboard.press('Enter');
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('handles network failure gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Edge Case 3: Network failure during download
      await page.route('**/api/portal/documents/*', route => {
        route.abort('failed');
      });

      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/test-order-123');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      const documentLink = page.locator('a').filter({ hasText: '.pdf' }).first();
      await documentLink.click();

      // Should show error toast
      const toast = page.locator('[role="alert"]');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText(/failed|error|unavailable/i);

      // Page should remain stable
      await expect(page).toHaveURL(/\/portal\/orders\/test-order-123/);
    });

    test('handles malformed document metadata', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Edge Case 6: Document metadata is malformed
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/malformed-metadata-order');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Malformed document should appear as plain text
      const submittedInfo = page.locator('[data-testid="submitted-information"]');
      await expect(submittedInfo).toContainText('malformed-doc.pdf');

      // Should not be rendered as a link
      const link = submittedInfo.locator('a').filter({ hasText: 'malformed-doc.pdf' });
      await expect(link).not.toBeVisible();
    });

    test('continues working when clicking multiple downloads', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Edge Case 7: Multiple simultaneous downloads
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/multi-document-order');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Click multiple document links quickly
      const links = page.locator('a').filter({ hasText: '.pdf' });
      const count = await links.count();
      expect(count).toBeGreaterThan(1);

      // Start multiple downloads
      const downloadPromises = [];
      for (let i = 0; i < Math.min(3, count); i++) {
        downloadPromises.push(page.waitForEvent('download'));
        await links.nth(i).click();
        await page.waitForTimeout(100); // Small delay between clicks
      }

      // All downloads should complete
      const downloads = await Promise.all(downloadPromises);
      downloads.forEach(download => {
        expect(download).toBeTruthy();
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      });
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('document links work on mobile viewport', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/test-order-123');

      // On mobile, might need to scroll to see order item
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.scrollIntoViewIfNeeded();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      // Document link should be visible and clickable
      const documentLink = page.locator('a').filter({ hasText: '.pdf' }).first();
      await documentLink.scrollIntoViewIfNeeded();
      await expect(documentLink).toBeVisible();

      // File size should still be visible
      const linkText = await documentLink.textContent();
      expect(linkText).toMatch(/\(\d+(\.\d+)?\s*(KB|MB)\)/);

      // Download should work
      const downloadPromise = page.waitForEvent('download');
      await documentLink.click();
      const download = await downloadPromise;
      expect(download).toBeTruthy();
    });

    test('document links remain readable on small screens', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/portal/orders/test-order-123');
      const orderItemRow = page.locator('[data-testid="order-item-row"]').first();
      await orderItemRow.locator('button[aria-label="Expand details"]').click();

      const documentLink = page.locator('a').filter({ hasText: '.pdf' }).first();
      await expect(documentLink).toBeVisible();

      // Text should not be truncated
      const linkText = await documentLink.textContent();
      expect(linkText).toContain('.pdf');
      expect(linkText).toMatch(/\(\d+(\.\d+)?\s*(KB|MB)\)/);

      // Link should still be blue
      await expect(documentLink).toHaveCSS('color', 'rgb(37, 99, 235)');
    });
  });
});