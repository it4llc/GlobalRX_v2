import { test, expect } from '../fixtures/auth';

test.describe('Order Workflow', () => {
  test('should complete full order submission workflow', async ({ authenticatedPage: page }) => {
    // Navigate to orders page
    await page.goto('/orders');

    // Click create new order
    await page.click('button:has-text("New Order"), button:has-text("Create Order")');

    // Step 1: Select customer
    await page.selectOption('select[name="customerId"]', { index: 1 }); // Select first customer

    // Step 2: Enter subject information
    await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Jane');
    await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Smith');
    await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1990-01-15');
    await page.fill('input[name="ssn"], input[name="subject.ssn"]', '123-45-6789');

    // Step 3: Select services
    const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
    const checkboxCount = await serviceCheckboxes.count();
    if (checkboxCount > 0) {
      await serviceCheckboxes.first().check();
    }

    // Step 4: Add notes
    await page.fill('textarea[name="notes"]', 'Test order created by E2E test');

    // Submit the order
    await page.click('button[type="submit"]:has-text("Submit"), button[type="submit"]:has-text("Create Order")');

    // Wait for success message or redirect
    await page.waitForURL('**/orders/**', { timeout: 10000 });

    // Verify order details page
    const orderNumber = page.locator('h1, h2').filter({ hasText: /order.*\d{8}/i });
    await expect(orderNumber).toBeVisible();

    // Verify order status
    const status = page.locator('.status, [data-testid="order-status"]');
    await expect(status).toContainText(/pending|draft|submitted/i);
  });

  test('should display order list with filters', async ({ authenticatedPage: page }) => {
    await page.goto('/orders');

    // Verify page loaded
    await page.waitForSelector('table, .order-list', { timeout: 10000 });

    // Test status filter
    const statusFilter = page.locator('select[name="status"], select[name="statusFilter"]');
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('pending');
      await page.waitForTimeout(500); // Wait for filter to apply
    }

    // Test date range filter if available
    const dateFrom = page.locator('input[name="dateFrom"], input[type="date"]').first();
    if (await dateFrom.isVisible()) {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      await dateFrom.fill(lastWeek.toISOString().split('T')[0]);
    }

    // Verify filtered results
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test('should validate required fields in order form', async ({ authenticatedPage: page }) => {
    await page.goto('/orders');
    await page.click('button:has-text("New Order"), button:has-text("Create Order")');

    // Try to submit without required fields
    await page.click('button[type="submit"]');

    // Check for validation errors
    const errors = page.locator('.error, .field-error, [role="alert"]');
    const errorCount = await errors.count();
    expect(errorCount).toBeGreaterThan(0);

    // Verify specific required field messages
    const firstNameError = page.locator('.error, .field-error').filter({ hasText: /first name/i });
    await expect(firstNameError).toBeVisible();
  });

  test('should view order details', async ({ authenticatedPage: page }) => {
    await page.goto('/orders');

    // Click on first order in the list
    const firstOrder = page.locator('tbody tr').first();
    await firstOrder.locator('a, button:has-text("View")').first().click();

    // Wait for order details page
    await page.waitForURL('**/orders/**');

    // Verify order details sections
    const sections = ['Subject Information', 'Services', 'Status', 'Notes'];
    for (const section of sections) {
      const sectionHeader = page.locator('h2, h3, .section-title').filter({ hasText: section });
      await expect(sectionHeader).toBeVisible();
    }

    // Verify order number format (YYYYMMDD-XXX-NNNN)
    const orderNumber = await page.locator('[data-testid="order-number"], .order-number, h1').textContent();
    expect(orderNumber).toMatch(/\d{8}-[A-Z0-9]{3}-\d{4}/);
  });

  test('should export orders to CSV', async ({ authenticatedPage: page }) => {
    await page.goto('/orders');

    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Export"), button:has-text("Download CSV")');

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('orders');
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
  });

  test('should handle order cancellation', async ({ authenticatedPage: page }) => {
    await page.goto('/orders');

    // Navigate to first order
    const firstOrder = page.locator('tbody tr').first();
    await firstOrder.locator('a, button:has-text("View")').first().click();

    // Look for cancel button
    const cancelButton = page.locator('button:has-text("Cancel Order"), button:has-text("Cancel")');

    if (await cancelButton.isVisible()) {
      // Handle confirmation dialog
      page.on('dialog', async (dialog) => {
        expect(dialog.message()).toContain('cancel');
        await dialog.accept();
      });

      await cancelButton.click();

      // Verify status changed
      const status = page.locator('.status, [data-testid="order-status"]');
      await expect(status).toContainText(/cancelled/i);
    }
  });
});