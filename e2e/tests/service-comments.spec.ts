// /GlobalRX_v2/e2e/tests/service-comments.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Service Comments', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as internal user with fulfillment permission
    await loginPage.goto();
    await loginPage.login('admin@globalrx.com', 'adminpass123');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Adding Comments to Services', () => {
    test('internal user can add comment to service', async ({ page }) => {
      // Navigate to orders
      await page.getByRole('link', { name: /orders/i }).click();

      // Find and click on an order with services
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Wait for order details page to load
      await expect(page.getByText(/order details/i)).toBeVisible();

      // Click on a service tab (e.g., Background Check)
      await page.getByRole('tab', { name: /background check/i }).click();

      // Click Add Comment button
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select template from dropdown
      await page.getByLabel(/template/i).selectOption({ label: 'Document Required' });

      // Template text should appear with placeholders
      const templateText = page.getByTestId('template-preview');
      await expect(templateText).toBeVisible();
      await expect(templateText).toContainText('[');

      // Fill in the placeholders
      const finalTextInput = page.getByLabel(/comment text/i);
      await finalTextInput.clear();
      await finalTextInput.fill('Driver license copy required for verification');

      // Verify Internal Only checkbox is checked by default
      const internalCheckbox = page.getByLabel(/internal only/i);
      await expect(internalCheckbox).toBeChecked();

      // Submit the comment
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear in the list
      await expect(page.getByText('Driver license copy required for verification')).toBeVisible();
      await expect(page.getByText('Document Required')).toBeVisible(); // Template name
      await expect(page.getByText(/internal/i)).toBeVisible(); // Internal badge
    });

    test('vendor user can add comment to assigned service', async ({ page }) => {
      // Logout and login as vendor
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendor@example.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // Navigate to assigned orders
      await page.getByRole('link', { name: /my orders|assigned/i }).click();

      // Open an assigned order
      await page.getByRole('row').first().click();

      // Click on an assigned service tab
      await page.getByRole('tab').first().click();

      // Add comment
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 0 });
      await page.getByLabel(/comment text/i).fill('Verification in progress');

      // Make comment external (visible to customer)
      await page.getByLabel(/internal only/i).uncheck();

      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear
      await expect(page.getByText('Verification in progress')).toBeVisible();
      await expect(page.getByText(/external/i)).toBeVisible(); // External badge
    });

    test('shows error when required fields are missing', async ({ page }) => {
      // Navigate to order with services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Try to add comment without selecting template
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/template is required/i)).toBeVisible();

      // Select template but leave text empty
      await page.getByLabel(/template/i).selectOption({ index: 0 });
      await page.getByLabel(/comment text/i).clear();
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/comment text.*required|cannot be empty/i)).toBeVisible();
    });

    test('shows error when comment text exceeds 1000 characters', async ({ page }) => {
      // Navigate to order with services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Try to add comment with text exceeding limit
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 0 });

      const longText = 'a'.repeat(1001);
      await page.getByLabel(/comment text/i).fill(longText);

      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/cannot exceed 1000 characters/i)).toBeVisible();
    });

    test('user without fulfillment permission cannot add comments', async ({ page }) => {
      // Logout and login as user without fulfillment permission
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('viewer@globalrx.com', 'viewerpass');
      await page.waitForURL('**/dashboard');

      // Navigate to orders
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').first().click();
      await page.getByRole('tab').first().click();

      // Add Comment button should not be visible or be disabled
      const addButton = page.getByRole('button', { name: /add comment/i });
      // Check if button is either disabled or not visible
      const isDisabled = await addButton.isDisabled().catch(() => false);
      const isVisible = await addButton.isVisible().catch(() => false);
      expect(isDisabled || !isVisible).toBeTruthy();
    });
  });

  test.describe('Viewing Service Comments', () => {
    test('internal user sees all comments (internal and external)', async ({ page }) => {
      // Navigate to order with existing comments
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Has Comments' }).first().click();
      await page.getByRole('tab', { name: /background check/i }).click();

      // Should see both internal and external comments
      await expect(page.getByText(/internal comment text/i)).toBeVisible();
      await expect(page.getByText(/external comment text/i)).toBeVisible();

      // Should see internal/external badges
      await expect(page.getByText('Internal', { exact: true })).toBeVisible();
      await expect(page.getByText('External', { exact: true })).toBeVisible();
    });

    test('vendor user sees all comments for assigned services', async ({ page }) => {
      // Logout and login as vendor
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendor@example.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // Navigate to assigned order
      await page.getByRole('link', { name: /my orders|assigned/i }).click();
      await page.getByRole('row').filter({ hasText: 'Has Comments' }).first().click();
      await page.getByRole('tab').first().click();

      // Vendor should see both internal and external comments
      await expect(page.getByText(/internal comment/i)).toBeVisible();
      await expect(page.getByText(/external comment/i)).toBeVisible();
    });

    test('customer user sees only external comments', async ({ page }) => {
      // Logout and login as customer
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('customer@example.com', 'customerpass');
      await page.waitForURL('**/dashboard');

      // Navigate to customer's order
      await page.getByRole('link', { name: /my orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Has Comments' }).first().click();
      await page.getByRole('tab').first().click();

      // Customer should only see external comments
      await expect(page.getByText(/external comment/i)).toBeVisible();

      // Should NOT see internal comments
      await expect(page.getByText(/internal comment/i)).not.toBeVisible();

      // Should NOT see Internal badge
      await expect(page.getByText('Internal', { exact: true })).not.toBeVisible();
    });

    test('comments display in chronological order (newest first)', async ({ page }) => {
      // Navigate to order with multiple comments
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Multiple Comments' }).first().click();
      await page.getByRole('tab').first().click();

      // Get all comment timestamps
      const timestamps = await page.locator('[data-testid="comment-timestamp"]').allTextContents();

      // Verify timestamps are in descending order
      for (let i = 0; i < timestamps.length - 1; i++) {
        const current = new Date(timestamps[i]);
        const next = new Date(timestamps[i + 1]);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    test('comment shows creator and update information', async ({ page }) => {
      // Navigate to order with edited comment
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Edited Comment' }).first().click();
      await page.getByRole('tab').first().click();

      // Find comment with edit history
      const commentCard = page.locator('[data-testid="comment-card"]').filter({ hasText: 'Edited' });

      // Should show created by information
      await expect(commentCard.getByText(/created by:/i)).toBeVisible();
      await expect(commentCard.getByText(/john doe/i)).toBeVisible();

      // Should show updated by information
      await expect(commentCard.getByText(/updated by:/i)).toBeVisible();
      await expect(commentCard.getByText(/jane smith/i)).toBeVisible();

      // Should show timestamps
      await expect(commentCard.getByText(/created at:/i)).toBeVisible();
      await expect(commentCard.getByText(/updated at:/i)).toBeVisible();
    });

    test('shows comment count badge on service tabs', async ({ page }) => {
      // Navigate to order with comments on multiple services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Multi-Service' }).first().click();

      // Check that tabs show comment count badges
      const backgroundTab = page.getByRole('tab', { name: /background check/i });
      await expect(backgroundTab.getByTestId('comment-count')).toHaveText('3');

      const drugTestTab = page.getByRole('tab', { name: /drug test/i });
      await expect(drugTestTab.getByTestId('comment-count')).toHaveText('1');

      const educationTab = page.getByRole('tab', { name: /education/i });
      // No badge if no comments
      await expect(educationTab.getByTestId('comment-count')).not.toBeVisible();
    });
  });

  test.describe('Editing Comments', () => {
    test('internal user can edit existing comment', async ({ page }) => {
      // Navigate to order with existing comment
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Editable Comment' }).first().click();
      await page.getByRole('tab').first().click();

      // Find and click edit button on a comment
      const commentCard = page.locator('[data-testid="comment-card"]').first();
      await commentCard.getByRole('button', { name: /edit/i }).click();

      // Edit form should appear with current text
      const editInput = page.getByLabel(/comment text/i);
      await expect(editInput).toHaveValue(/original comment text/i);

      // Update the text
      await editInput.clear();
      await editInput.fill('Updated comment text after review');

      // Can also change visibility
      await page.getByLabel(/internal only/i).uncheck();

      // Save changes
      await page.getByRole('button', { name: /save|update/i }).click();

      // Updated comment should be visible
      await expect(page.getByText('Updated comment text after review')).toBeVisible();

      // Should show as edited
      await expect(commentCard.getByText(/edited|updated/i)).toBeVisible();
      await expect(commentCard.getByText(/updated by/i)).toBeVisible();
    });

    test('vendor user cannot edit comments', async ({ page }) => {
      // Logout and login as vendor
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendor@example.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // Navigate to assigned order with comments
      await page.getByRole('link', { name: /my orders|assigned/i }).click();
      await page.getByRole('row').filter({ hasText: 'Has Comments' }).first().click();
      await page.getByRole('tab').first().click();

      // Edit button should not be visible on comments
      const commentCards = page.locator('[data-testid="comment-card"]');
      const editButtons = commentCards.getByRole('button', { name: /edit/i });
      await expect(editButtons).toHaveCount(0);
    });

    test('customer user cannot edit comments', async ({ page }) => {
      // Logout and login as customer
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('customer@example.com', 'customerpass');
      await page.waitForURL('**/dashboard');

      // Navigate to customer's order
      await page.getByRole('link', { name: /my orders/i }).click();
      await page.getByRole('row').first().click();
      await page.getByRole('tab').first().click();

      // Edit button should not be visible on comments
      const commentCards = page.locator('[data-testid="comment-card"]');
      const editButtons = commentCards.getByRole('button', { name: /edit/i });
      await expect(editButtons).toHaveCount(0);
    });

    test('shows error when edited text is empty', async ({ page }) => {
      // Navigate to order with existing comment
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Editable Comment' }).first().click();
      await page.getByRole('tab').first().click();

      // Edit a comment
      await page.locator('[data-testid="comment-card"]').first().getByRole('button', { name: /edit/i }).click();

      // Clear the text
      await page.getByLabel(/comment text/i).clear();

      // Try to save
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show validation error
      await expect(page.getByText(/comment text.*required|cannot be empty/i)).toBeVisible();
    });

    test('shows error when edited text exceeds 1000 characters', async ({ page }) => {
      // Navigate to order with existing comment
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Editable Comment' }).first().click();
      await page.getByRole('tab').first().click();

      // Edit a comment
      await page.locator('[data-testid="comment-card"]').first().getByRole('button', { name: /edit/i }).click();

      // Set text exceeding limit
      const longText = 'a'.repeat(1001);
      await page.getByLabel(/comment text/i).fill(longText);

      // Try to save
      await page.getByRole('button', { name: /save|update/i }).click();

      // Should show validation error
      await expect(page.getByText(/cannot exceed 1000 characters/i)).toBeVisible();
    });
  });

  test.describe('Template Integration', () => {
    test('only shows templates available for service type and status', async ({ page }) => {
      // Navigate to order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').first().click();

      // Click on Background Check service (status: Processing)
      await page.getByRole('tab', { name: /background check/i }).click();
      await page.getByRole('button', { name: /add comment/i }).click();

      // Get template options
      const templateSelect = page.getByLabel(/template/i);
      const options = await templateSelect.locator('option').allTextContents();

      // Should only show templates configured for BACKGROUND_CHECK + PROCESSING
      expect(options).toContain('Processing Update');
      expect(options).toContain('Document Required');
      expect(options).not.toContain('Completion Notice'); // Only for COMPLETED status

      // Cancel and switch to completed service
      await page.getByRole('button', { name: /cancel/i }).click();
      await page.getByRole('tab', { name: /education verification/i }).click(); // Assume this is completed
      await page.getByRole('button', { name: /add comment/i }).click();

      const completedOptions = await templateSelect.locator('option').allTextContents();

      // Should show different templates for EDUCATION_VERIFICATION + COMPLETED
      expect(completedOptions).toContain('Completion Notice');
      expect(completedOptions).toContain('Results Available');
      expect(completedOptions).not.toContain('Processing Update'); // Only for PROCESSING status
    });

    test('shows template preview with placeholders highlighted', async ({ page }) => {
      // Navigate to order and service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').first().click();
      await page.getByRole('tab').first().click();

      // Open comment form
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select a template with placeholders
      await page.getByLabel(/template/i).selectOption({ label: 'Document Request' });

      // Template preview should show with placeholders
      const preview = page.getByTestId('template-preview');
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('Please provide [document type] by [date]');

      // Placeholders should be highlighted (different styling)
      const placeholders = preview.locator('.placeholder');
      await expect(placeholders).toHaveCount(2);
      await expect(placeholders.first()).toHaveCSS('background-color', /yellow|highlight/i);
    });

    test('validates that placeholders are replaced before saving', async ({ page }) => {
      // Navigate to order and service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').first().click();
      await page.getByRole('tab').first().click();

      // Add comment with template
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ label: 'Document Request' });

      // Don't replace placeholders
      const textInput = page.getByLabel(/comment text/i);
      await textInput.fill('Please provide [document type] by [date]');

      // Try to save
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show warning or error about unreplaced placeholders
      await expect(page.getByText(/placeholder.*not replaced|contains placeholder/i)).toBeVisible();
    });
  });

  test.describe('Bulk Loading for Order Page', () => {
    test('efficiently loads all service comments when opening order', async ({ page }) => {
      // Monitor network requests
      const commentsRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/') && request.url().includes('comments')) {
          commentsRequests.push(request.url());
        }
      });

      // Navigate to order with multiple services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Multi-Service Order' }).first().click();

      // Wait for page to load
      await expect(page.getByText(/order details/i)).toBeVisible();

      // Should make ONE bulk request for all service comments
      const bulkRequests = commentsRequests.filter(url => url.includes('/orders/') && url.includes('/services/comments'));
      expect(bulkRequests.length).toBe(1);

      // All service tabs should show comment counts immediately
      await expect(page.getByRole('tab', { name: /background check/i }).getByTestId('comment-count')).toBeVisible();
      await expect(page.getByRole('tab', { name: /drug test/i }).getByTestId('comment-count')).toBeVisible();
      await expect(page.getByRole('tab', { name: /education/i }).getByTestId('comment-count')).toBeVisible();

      // Clicking tabs should not make additional API calls
      const requestCountBefore = commentsRequests.length;
      await page.getByRole('tab', { name: /drug test/i }).click();
      await page.waitForTimeout(500); // Wait to see if any requests are made
      expect(commentsRequests.length).toBe(requestCountBefore); // No new requests
    });
  });
});