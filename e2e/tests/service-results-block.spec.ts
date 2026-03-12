// /GlobalRX_v2/tests/e2e/service-results-block.spec.ts
// End-to-end tests for Service Results Block feature

import { test, expect } from '@playwright/test';

test.describe('Service Results Block - Internal User Journey', () => {

  test('internal user can add and edit service results', async ({ page }) => {
    // Step 1: Login as internal user with fulfillment.edit permission
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Step 2: Navigate to fulfillment dashboard
    await page.waitForURL(/\/fulfillment|\/dashboard/);

    // Step 3: Find an order with services
    await page.click('text=Orders');
    await page.waitForSelector('[data-testid="orders-table"]');

    // Click on a specific order
    await page.click('text=20240310-ABC-0001');
    await page.waitForURL(/\/fulfillment\/orders\/.+/);

    // Step 4: Expand a service row to see results section
    const serviceRow = page.locator('[data-testid="service-row"]').first();
    await serviceRow.click();

    // Wait for expansion
    await expect(page.locator('[data-testid="service-results-section"]').first()).toBeVisible();

    // Step 5: Add results to the service
    const resultsTextarea = page.locator('[data-testid="service-results-textarea"]').first();
    await resultsTextarea.fill('Background check completed. Subject has clean record. No criminal history found in state and federal databases.');

    // Save the results
    await page.click('[data-testid="save-results-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Results saved successfully/);

    // Step 6: Verify results are displayed
    await expect(resultsTextarea).toHaveValue(/Background check completed/);

    // Step 7: Edit the results
    await resultsTextarea.fill('Background check completed. Subject has clean record. No criminal history found in state and federal databases.\n\nAdditional verification completed on 03/11/2024.');
    await page.click('[data-testid="save-results-button"]');

    // Verify update success
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Results updated successfully/);
  });

  test('internal user can upload and manage PDF attachments', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order details
    await page.goto('/fulfillment/orders/order-123');

    // Expand service row
    const serviceRow = page.locator('[data-testid="service-row"]').first();
    await serviceRow.click();

    // Step 1: Upload a PDF attachment
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    await fileInput.setInputFiles('test-files/background-check-report.pdf');

    // Click upload button
    await page.click('[data-testid="upload-attachment-button"]');

    // Wait for upload success
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Attachment uploaded successfully/);

    // Step 2: Verify attachment appears in list
    const attachmentsList = page.locator('[data-testid="attachments-list"]').first();
    await expect(attachmentsList.locator('text=background-check-report.pdf')).toBeVisible();

    // Step 3: Download the attachment
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-attachment-0"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toBe('background-check-report.pdf');

    // Step 4: Delete the attachment
    await page.click('[data-testid="delete-attachment-0"]');

    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify deletion success
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Attachment deleted successfully/);

    // Verify attachment is removed from list
    await expect(attachmentsList.locator('text=background-check-report.pdf')).not.toBeVisible();
  });

  test('shows error when trying to edit completed service', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order with completed service
    await page.goto('/fulfillment/orders/order-completed');

    // Expand completed service row
    const completedService = page.locator('[data-testid="service-row"][data-status="completed"]').first();
    await completedService.click();

    // Verify results textarea is disabled
    const resultsTextarea = page.locator('[data-testid="service-results-textarea"]').first();
    await expect(resultsTextarea).toBeDisabled();

    // Verify save button is disabled
    await expect(page.locator('[data-testid="save-results-button"]')).toBeDisabled();

    // Verify upload button is disabled
    await expect(page.locator('[data-testid="upload-attachment-button"]')).toBeDisabled();

    // Verify delete buttons are disabled
    const deleteButtons = page.locator('[data-testid^="delete-attachment-"]');
    for (const button of await deleteButtons.all()) {
      await expect(button).toBeDisabled();
    }

    // Verify info message
    await expect(page.locator('[data-testid="terminal-status-message"]')).toHaveText(/Cannot edit results for completed service/);
  });
});

test.describe('Service Results Block - Vendor User Journey', () => {

  test('vendor can add results to assigned service only', async ({ page }) => {
    // Step 1: Login as vendor user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'vendor@backgroundchecks.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Step 2: Navigate to vendor dashboard
    await page.waitForURL(/\/vendor\/dashboard/);

    // Step 3: View assigned orders
    await page.click('text=My Assigned Services');
    await page.waitForSelector('[data-testid="vendor-services-table"]');

    // Step 4: Click on an assigned service
    await page.click('[data-testid="service-ABC123"]');

    // Step 5: Expand service to see results section
    await page.click('[data-testid="expand-service-button"]');
    await expect(page.locator('[data-testid="service-results-section"]')).toBeVisible();

    // Step 6: Add vendor results
    const resultsTextarea = page.locator('[data-testid="service-results-textarea"]');
    await resultsTextarea.fill('Vendor investigation complete. All required checks performed per customer requirements.');

    await page.click('[data-testid="save-results-button"]');

    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Results saved successfully/);

    // Step 7: Verify non-assigned services don't have edit capability
    await page.goto('/fulfillment/orders/order-not-assigned');

    const nonAssignedService = page.locator('[data-testid="service-row"]').first();
    await nonAssignedService.click();

    // Verify results are read-only
    const readOnlyTextarea = page.locator('[data-testid="service-results-textarea"]').first();
    await expect(readOnlyTextarea).toBeDisabled();

    // Verify no save button
    await expect(page.locator('[data-testid="save-results-button"]')).not.toBeVisible();
  });

  test('vendor can upload attachments for assigned services', async ({ page }) => {
    // Login as vendor
    await page.goto('/login');
    await page.fill('input[name="email"]', 'vendor@backgroundchecks.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to assigned service
    await page.goto('/vendor/services/service-ABC123');

    // Expand service details
    await page.click('[data-testid="expand-service-button"]');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/vendor-report.pdf');

    await page.click('[data-testid="upload-attachment-button"]');

    // Verify upload success
    await expect(page.locator('[data-testid="toast-success"]')).toHaveText(/Attachment uploaded successfully/);

    // Verify file appears
    await expect(page.locator('text=vendor-report.pdf')).toBeVisible();
  });
});

test.describe('Service Results Block - Customer User Journey', () => {

  test('customer can view results and download attachments (read-only)', async ({ page }) => {
    // Step 1: Login as customer
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Step 2: Navigate to my orders
    await page.click('text=My Orders');
    await page.waitForSelector('[data-testid="customer-orders-table"]');

    // Step 3: Click on an order
    await page.click('text=20240310-ABC-0001');
    await page.waitForURL(/\/fulfillment\/orders\/.+/);

    // Step 4: Expand service to view results
    const serviceRow = page.locator('[data-testid="service-row"]').first();
    await serviceRow.click();

    await expect(page.locator('[data-testid="service-results-section"]')).toBeVisible();

    // Step 5: Verify results are displayed but read-only
    const resultsTextarea = page.locator('[data-testid="service-results-textarea"]');
    await expect(resultsTextarea).toBeVisible();
    await expect(resultsTextarea).toBeDisabled();
    await expect(resultsTextarea).toHaveValue(/Background check completed/);

    // Verify no save button
    await expect(page.locator('[data-testid="save-results-button"]')).not.toBeVisible();

    // Step 6: View attachments list
    const attachmentsList = page.locator('[data-testid="attachments-list"]');
    await expect(attachmentsList).toBeVisible();
    await expect(attachmentsList.locator('text=final-report.pdf')).toBeVisible();

    // Verify no upload button
    await expect(page.locator('[data-testid="upload-attachment-button"]')).not.toBeVisible();

    // Verify no delete buttons
    await expect(page.locator('[data-testid^="delete-attachment-"]')).not.toBeVisible();

    // Step 7: Download attachment
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-attachment-0"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toBe('final-report.pdf');
  });

  test('customer cannot see results for other customers orders', async ({ page }) => {
    // Login as customer
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Try to navigate to another customer's order
    await page.goto('/fulfillment/orders/order-other-customer');

    // Should get access denied
    await expect(page.locator('[data-testid="access-denied-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="access-denied-message"]')).toHaveText(/You do not have permission to view this order/);
  });
});

test.describe('Service Results Block - File Validation', () => {

  test('rejects non-PDF files', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order
    await page.goto('/fulfillment/orders/order-123');

    // Expand service
    const serviceRow = page.locator('[data-testid="service-row"]').first();
    await serviceRow.click();

    // Try to upload a non-PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/image.jpg');

    await page.click('[data-testid="upload-attachment-button"]');

    // Verify error message
    await expect(page.locator('[data-testid="toast-error"]')).toHaveText(/File must be a PDF/);
  });

  test('rejects files over 5MB', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order
    await page.goto('/fulfillment/orders/order-123');

    // Expand service
    const serviceRow = page.locator('[data-testid="service-row"]').first();
    await serviceRow.click();

    // Try to upload a large file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-files/large-file-6mb.pdf');

    await page.click('[data-testid="upload-attachment-button"]');

    // Verify error message
    await expect(page.locator('[data-testid="toast-error"]')).toHaveText(/File size cannot exceed 5MB/);
  });
});

test.describe('Service Results Block - UI Indicators', () => {

  test('shows indicator when service has results or attachments', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to orders list
    await page.goto('/fulfillment/orders');

    // Find order with services
    await page.click('text=20240310-ABC-0001');

    // Check for indicators on services with results
    const serviceWithResults = page.locator('[data-testid="service-row"][data-has-results="true"]').first();
    await expect(serviceWithResults.locator('[data-testid="results-indicator"]')).toBeVisible();
    await expect(serviceWithResults.locator('[data-testid="results-indicator"]')).toHaveAttribute('title', 'Has results');

    // Check for indicators on services with attachments
    const serviceWithAttachments = page.locator('[data-testid="service-row"][data-has-attachments="true"]').first();
    await expect(serviceWithAttachments.locator('[data-testid="attachments-indicator"]')).toBeVisible();

    // Check attachment count badge
    const attachmentBadge = serviceWithAttachments.locator('[data-testid="attachment-count-badge"]');
    await expect(attachmentBadge).toHaveText('2'); // Or whatever count
  });

  test('shows correct empty state when no results or attachments', async ({ page }) => {
    // Login as internal user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'fulfillment@globalrx.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate to order with empty service
    await page.goto('/fulfillment/orders/order-new');

    // Expand service without results
    const emptyService = page.locator('[data-testid="service-row"][data-has-results="false"]').first();
    await emptyService.click();

    // Check empty state for results
    const resultsTextarea = page.locator('[data-testid="service-results-textarea"]');
    await expect(resultsTextarea).toHaveValue('');
    await expect(resultsTextarea).toHaveAttribute('placeholder', 'Enter search results...');

    // Check empty state for attachments
    await expect(page.locator('[data-testid="no-attachments-message"]')).toHaveText('No attachments uploaded');
  });
});