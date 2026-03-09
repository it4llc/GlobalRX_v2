/**
 * SPEC CONFIRMATION BLOCK
 * Specification: docs/specs/service-comment-status-change.md
 *
 * Key Requirements:
 * - Internal users only can change status (Phase 2d)
 * - Status dropdown separate from comment form
 * - All 7 statuses available (Draft, Submitted, Processing, Missing Information, Completed, Cancelled, Cancelled-DNB)
 * - Terminal status changes require confirmation (Completed, Cancelled, Cancelled-DNB)
 * - Status changes recorded as ServiceComment with isStatusChange=true
 * - Order locking prevents concurrent edits
 * - 15-minute lock timeout
 * - Admin can force-release locks
 */

// /GlobalRX_v2/e2e/tests/service-status-change.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Service Status Change', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as internal user with fulfillment permission
    await loginPage.goto();
    await loginPage.login('admin@globalrx.com', 'adminpass123');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Viewing and Changing Service Status', () => {
    test('internal user can change service status without comment', async ({ page }) => {
      // Navigate to orders
      await page.getByRole('link', { name: /orders/i }).click();

      // Find and click on an order with services
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Wait for order details page to load
      await expect(page.getByText(/order details/i)).toBeVisible();

      // Order should be locked for this user
      await expect(page.getByTestId('lock-indicator')).not.toBeVisible();

      // Click on a service tab (e.g., Background Check)
      await page.getByRole('tab', { name: /background check/i }).click();

      // Current status should be visible and clickable
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await expect(statusDropdown).toBeVisible();
      const currentStatus = await statusDropdown.textContent();

      // Click on the status to open dropdown
      await statusDropdown.click();

      // All status options should be available
      const statusOptions = page.getByRole('option');
      await expect(statusOptions).toHaveCount(7);

      // Select a new status
      await page.getByRole('option', { name: 'Processing' }).click();

      // Status should update immediately
      await expect(statusDropdown).toContainText('Processing');

      // Status change should appear in comment timeline
      const timeline = page.getByTestId('comment-timeline');
      await expect(timeline).toContainText(/Status changed from .* to Processing/);

      // Status change entry should have special formatting
      const statusChangeEntry = timeline.locator('[data-is-status-change="true"]').first();
      await expect(statusChangeEntry).toHaveClass(/status-change/);
      await expect(statusChangeEntry).toBeVisible();
    });

    test('internal user can add optional comment with status change', async ({ page }) => {
      // Navigate to order with services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab', { name: /background check/i }).click();

      // Click on status dropdown
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await statusDropdown.click();

      // Select new status
      await page.getByRole('option', { name: 'Missing Information' }).click();

      // Optional comment field should appear
      const commentInput = page.getByPlaceholder(/add reason for status change/i);
      await expect(commentInput).toBeVisible();

      // Add comment
      await commentInput.fill('Driver license copy is required for verification');
      await page.getByRole('button', { name: /confirm/i }).click();

      // Status should be updated
      await expect(statusDropdown).toContainText('Missing Information');

      // Comment should appear with status change
      const timeline = page.getByTestId('comment-timeline');
      await expect(timeline).toContainText('Driver license copy is required for verification');
      await expect(timeline).toContainText(/Status changed from .* to Missing Information/);
    });

    test('requires confirmation when changing from terminal status', async ({ page, context }) => {
      // Navigate to order with completed service
      await page.getByRole('link', { name: /orders/i }).click();

      // Find order with completed service
      await page.getByRole('row').filter({ hasText: 'Completed' }).first().click();
      await page.getByRole('tab').first().click();

      // Find service with Completed status
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await expect(statusDropdown).toContainText('Completed');

      // Try to change from Completed status
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Processing' }).click();

      // Confirmation dialog should appear
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText(/This service is currently Completed/);
      await expect(confirmDialog).toContainText(/Are you sure you want to re-open it/);

      // Cancel should not change status
      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(statusDropdown).toContainText('Completed');

      // Try again and confirm
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Processing' }).click();
      await expect(confirmDialog).toBeVisible();
      await page.getByRole('button', { name: /confirm|yes/i }).click();

      // Status should be changed
      await expect(statusDropdown).toContainText('Processing');

      // Timeline should show reopening
      const timeline = page.getByTestId('comment-timeline');
      await expect(timeline).toContainText(/Status changed from Completed to Processing/);
      await expect(timeline).toContainText(/reopened/i);
    });

    test('all seven status values are available', async ({ page }) => {
      // Navigate to order with services
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').first().click();
      await page.getByRole('tab').first().click();

      // Open status dropdown
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await statusDropdown.click();

      // Verify all statuses are present
      const expectedStatuses = [
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ];

      for (const status of expectedStatuses) {
        await expect(page.getByRole('option', { name: status })).toBeVisible();
      }
    });

    test('vendor cannot change service status in Phase 2d', async ({ page }) => {
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

      // Status should be visible but not clickable for vendors
      const statusDisplay = page.getByTestId('service-status-display');
      await expect(statusDisplay).toBeVisible();

      // Dropdown should not exist or be disabled
      const statusDropdown = page.getByTestId('service-status-dropdown');
      const dropdownExists = await statusDropdown.count() > 0;

      if (dropdownExists) {
        await expect(statusDropdown).toBeDisabled();
      } else {
        await expect(statusDisplay).not.toHaveAttribute('role', 'button');
      }
    });
  });

  test.describe('Order Locking', () => {
    test('order is locked when user opens it', async ({ page, context }) => {
      // Open first browser/user session
      await page.getByRole('link', { name: /orders/i }).click();
      const orderRow = page.getByRole('row').filter({ hasText: 'Processing' }).first();
      const orderId = await orderRow.getAttribute('data-order-id');
      await orderRow.click();

      // Order should be locked for this user
      await expect(page.getByText(/order details/i)).toBeVisible();
      await expect(page.getByTestId('lock-indicator')).not.toBeVisible();

      // Open second browser session
      const newPage = await context.newPage();
      const loginPage2 = new LoginPage(newPage);
      await loginPage2.goto();
      await loginPage2.login('user2@globalrx.com', 'userpass123');
      await newPage.waitForURL('**/dashboard');

      // Navigate to same order
      await newPage.getByRole('link', { name: /orders/i }).click();
      await newPage.getByRole('row').filter({ hasText: orderId }).first().click();

      // Lock indicator should be visible for second user
      const lockIndicator = newPage.getByTestId('lock-indicator');
      await expect(lockIndicator).toBeVisible();
      await expect(lockIndicator).toContainText(/locked by/i);
      await expect(lockIndicator).toContainText('admin@globalrx.com');

      // Service status should not be editable
      await newPage.getByRole('tab').first().click();
      const statusDropdown = newPage.getByTestId('service-status-dropdown');
      const dropdownExists = await statusDropdown.count() > 0;

      if (dropdownExists) {
        await expect(statusDropdown).toBeDisabled();
      }

      // Clean up
      await newPage.close();
    });

    test('lock releases when user navigates away', async ({ page, context }) => {
      // First user opens order
      await page.getByRole('link', { name: /orders/i }).click();
      const orderRow = page.getByRole('row').filter({ hasText: 'Processing' }).first();
      await orderRow.click();

      // Verify order is locked
      await expect(page.getByText(/order details/i)).toBeVisible();

      // Navigate away to release lock
      await page.getByRole('link', { name: /dashboard/i }).click();
      await page.waitForURL('**/dashboard');

      // Open second browser session
      const newPage = await context.newPage();
      const loginPage2 = new LoginPage(newPage);
      await loginPage2.goto();
      await loginPage2.login('user2@globalrx.com', 'userpass123');
      await newPage.waitForURL('**/dashboard');

      // Second user should be able to acquire lock
      await newPage.getByRole('link', { name: /orders/i }).click();
      await newPage.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // No lock indicator should be visible
      await expect(newPage.getByTestId('lock-indicator')).not.toBeVisible();

      // Service should be editable
      await newPage.getByRole('tab').first().click();
      const statusDropdown = newPage.getByTestId('service-status-dropdown');
      await expect(statusDropdown).toBeEnabled();

      // Clean up
      await newPage.close();
    });

    test('admin can force-release lock', async ({ page, context }) => {
      // Regular user opens order
      const userPage = await context.newPage();
      const userLoginPage = new LoginPage(userPage);
      await userLoginPage.goto();
      await userLoginPage.login('user1@globalrx.com', 'userpass123');
      await userPage.waitForURL('**/dashboard');

      await userPage.getByRole('link', { name: /orders/i }).click();
      await userPage.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Admin navigates to same order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Lock indicator visible for admin
      const lockIndicator = page.getByTestId('lock-indicator');
      await expect(lockIndicator).toBeVisible();

      // Admin force-release button should be available
      const forceReleaseBtn = page.getByRole('button', { name: /force release|release lock/i });
      await expect(forceReleaseBtn).toBeVisible();

      // Click force release
      await forceReleaseBtn.click();

      // Confirm in dialog if shown
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        await page.getByRole('button', { name: /confirm|yes/i }).click();
      }

      // Lock should be released
      await expect(lockIndicator).not.toBeVisible();

      // Admin can now edit
      await page.getByRole('tab').first().click();
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await expect(statusDropdown).toBeEnabled();

      // Clean up
      await userPage.close();
    });

    test('lock expires after timeout', async ({ page, context }) => {
      // This test would need to mock time or wait for actual timeout
      // For demo purposes, showing the structure
      test.skip();

      // User opens order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Fast-forward time by 16 minutes (lock expires at 15 minutes)
      // This would require time mocking capability

      // Another user should be able to acquire lock
      const newPage = await context.newPage();
      const loginPage2 = new LoginPage(newPage);
      await loginPage2.goto();
      await loginPage2.login('user2@globalrx.com', 'userpass123');
      await newPage.waitForURL('**/dashboard');

      await newPage.getByRole('link', { name: /orders/i }).click();
      await newPage.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Should not see lock indicator
      await expect(newPage.getByTestId('lock-indicator')).not.toBeVisible();

      await newPage.close();
    });
  });

  test.describe('Status Change Audit Trail', () => {
    test('status changes appear in service comment timeline', async ({ page }) => {
      // Navigate to order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Make multiple status changes
      const statusDropdown = page.getByTestId('service-status-dropdown');

      // Change 1: To Processing
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Processing' }).click();

      // Change 2: To Missing Information with comment
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Missing Information' }).click();
      const commentInput = page.getByPlaceholder(/add reason/i);
      if (await commentInput.isVisible()) {
        await commentInput.fill('Need additional documents');
        await page.getByRole('button', { name: /confirm/i }).click();
      }

      // Change 3: To Completed
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Completed' }).click();

      // Timeline should show all changes
      const timeline = page.getByTestId('comment-timeline');

      // Should see all status changes
      await expect(timeline).toContainText(/Status changed from .* to Processing/);
      await expect(timeline).toContainText(/Status changed from Processing to Missing Information/);
      await expect(timeline).toContainText('Need additional documents');
      await expect(timeline).toContainText(/Status changed from Missing Information to Completed/);

      // Status change entries should be visually distinct
      const statusChangeEntries = timeline.locator('[data-is-status-change="true"]');
      const entryCount = await statusChangeEntries.count();
      expect(entryCount).toBeGreaterThanOrEqual(3);

      // Each should have special formatting
      for (let i = 0; i < entryCount; i++) {
        await expect(statusChangeEntries.nth(i)).toHaveClass(/status-change/);
      }
    });

    test('shows who changed status and when', async ({ page }) => {
      // Navigate to order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Change status
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Processing' }).click();

      // Timeline should show user info
      const timeline = page.getByTestId('comment-timeline');
      const latestEntry = timeline.locator('[data-is-status-change="true"]').first();

      await expect(latestEntry).toContainText('admin@globalrx.com');
      await expect(latestEntry).toContainText(/\d{1,2}:\d{2}/); // Time format

      // Should show relative time (e.g., "just now", "2 minutes ago")
      const timeElement = latestEntry.locator('[data-testid="relative-time"]');
      await expect(timeElement).toBeVisible();
    });
  });

  test.describe('Status Change Independence', () => {
    test('service status changes do not affect order status', async ({ page }) => {
      // Navigate to order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Note the order status
      const orderStatus = page.getByTestId('order-status');
      const initialOrderStatus = await orderStatus.textContent();

      // Change service status
      await page.getByRole('tab').first().click();
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Completed' }).click();

      // Order status should remain unchanged
      await expect(orderStatus).toContainText(initialOrderStatus);

      // Change another service to Cancelled
      await page.getByRole('tab').nth(1).click();
      const statusDropdown2 = page.getByTestId('service-status-dropdown');
      await statusDropdown2.click();
      await page.getByRole('option', { name: 'Cancelled' }).click();

      // Order status should still be unchanged
      await expect(orderStatus).toContainText(initialOrderStatus);
    });

    test('no notifications or assignments triggered on status change', async ({ page }) => {
      // Navigate to order
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Change status
      const statusDropdown = page.getByTestId('service-status-dropdown');
      await statusDropdown.click();
      await page.getByRole('option', { name: 'Completed' }).click();

      // No notification indicator should appear
      await expect(page.getByTestId('notification-sent')).not.toBeVisible();

      // No assignment dialog should appear
      await expect(page.getByRole('dialog', { name: /assign/i })).not.toBeVisible();

      // Service should not show new assignment
      const assignmentInfo = page.getByTestId('service-assignment');
      const originalAssignment = await assignmentInfo.textContent();

      // Wait a moment to ensure no async updates
      await page.waitForTimeout(1000);

      // Assignment should be unchanged
      await expect(assignmentInfo).toContainText(originalAssignment);
    });
  });
});