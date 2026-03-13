// /GlobalRX_v2/tests/e2e/order-status-management.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Order Status Management - E2E Tests', () => {

  test.describe('Manual Status Change by Internal Users', () => {
    test('internal user can change order status via dropdown in left sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as internal user with fulfillment permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to order details page
      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-123');

      // Step 3: Verify current status is displayed in dropdown
      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await expect(statusDropdown).toBeVisible();
      await expect(statusDropdown).toHaveValue('draft');

      // Step 4: Click dropdown to see all seven status options
      await statusDropdown.click();

      // Verify all seven status options are available
      const options = ['draft', 'submitted', 'processing', 'missing_info', 'completed', 'cancelled', 'cancelled_dnb'];
      for (const option of options) {
        await expect(page.locator(`option[value="${option}"]`)).toBeVisible();
      }

      // Step 5: Select new status
      await statusDropdown.selectOption('processing');

      // Step 6: Verify loading spinner appears
      await expect(page.locator('[data-testid="status-loading"], .spinner')).toBeVisible();

      // Step 7: Verify success toast
      await expect(page.locator('.toast, [role="status"]')).toContainText('Order status updated successfully');

      // Step 8: Verify new status is reflected in dropdown
      await expect(statusDropdown).toHaveValue('processing');

      // Step 9: Verify status history shows new entry
      const statusHistory = page.locator('[data-testid="status-history"], .status-history');
      await expect(statusHistory).toBeVisible();

      // First entry should be the new status change
      const firstHistoryEntry = statusHistory.locator('.history-entry').first();
      await expect(firstHistoryEntry).toContainText('processing');
      await expect(firstHistoryEntry).toContainText('draft');
      await expect(firstHistoryEntry).toContainText('internal@globalrx.com');
    });

    test('internal user without fulfillment permission cannot change status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user WITHOUT fulfillment permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal-no-fulfillment@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');

      // Should see status but not as a dropdown
      const statusText = page.locator('[data-testid="order-status-text"], .order-status');
      await expect(statusText).toContainText('Processing');

      // Should NOT see status dropdown
      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await expect(statusDropdown).not.toBeVisible();
    });

    test('shows error when network fails during status update', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');

      // Intercept API call to simulate network failure
      await page.route('**/api/fulfillment/orders/*/status', route => {
        route.abort('failed');
      });

      // Try to change status
      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await statusDropdown.selectOption('completed');

      // Should show error toast
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('Failed to update order status. Please try again.');

      // Dropdown should revert to original value
      await expect(statusDropdown).toHaveValue('draft');
    });

    test('allows status changes in any direction without restrictions', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order that is completed
      await page.goto('/fulfillment/orders/completed-order');

      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await expect(statusDropdown).toHaveValue('completed');

      // Should be able to change back to processing (regression scenario)
      await statusDropdown.selectOption('processing');

      // Should succeed
      await expect(page.locator('.toast, [role="status"]')).toContainText('Order status updated successfully');
      await expect(statusDropdown).toHaveValue('processing');

      // Should be able to change to any other status
      await statusDropdown.selectOption('cancelled');
      await expect(page.locator('.toast, [role="status"]')).toContainText('Order status updated successfully');
      await expect(statusDropdown).toHaveValue('cancelled');
    });
  });

  test.describe('Automatic Status Progression', () => {
    test('order automatically changes from draft to submitted when all services are submitted', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with multiple services in draft
      await page.goto('/fulfillment/orders/multi-service-order');

      // Verify order is in draft status
      const orderStatus = page.locator('[data-testid="order-status-dropdown"], select[name="orderStatus"]');
      await expect(orderStatus).toHaveValue('draft');

      // Navigate to service fulfillment for first service
      await page.click('[data-testid="service-1-link"]');

      // Update first service to submitted
      const service1Status = page.locator('[data-testid="service-status-dropdown"]');
      await service1Status.selectOption('submitted');
      await expect(page.locator('.toast')).toContainText('Service status updated');

      // Go back to order details
      await page.click('[data-testid="back-to-order"]');

      // Order should still be draft (not all services submitted)
      await expect(orderStatus).toHaveValue('draft');

      // Navigate to second service
      await page.click('[data-testid="service-2-link"]');

      // Update second service to submitted
      const service2Status = page.locator('[data-testid="service-status-dropdown"]');
      await service2Status.selectOption('submitted');
      await expect(page.locator('.toast')).toContainText('Service status updated');

      // Go back to order details
      await page.click('[data-testid="back-to-order"]');

      // Order should still be draft (not all services submitted)
      await expect(orderStatus).toHaveValue('draft');

      // Navigate to third (last) service
      await page.click('[data-testid="service-3-link"]');

      // Update third service to submitted
      const service3Status = page.locator('[data-testid="service-status-dropdown"]');
      await service3Status.selectOption('submitted');
      await expect(page.locator('.toast')).toContainText('Service status updated');

      // Go back to order details
      await page.click('[data-testid="back-to-order"]');

      // Order should now be automatically changed to submitted
      await expect(orderStatus).toHaveValue('submitted');

      // Check status history for automatic update
      const statusHistory = page.locator('[data-testid="status-history"]');
      const latestEntry = statusHistory.locator('.history-entry').first();
      await expect(latestEntry).toContainText('Automatically updated - all services submitted');
      await expect(latestEntry).toContainText('System');
    });

    test('order does not auto-progress if already past draft status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order that is already processing with one service not submitted
      await page.goto('/fulfillment/orders/processing-order');

      // Verify order is in processing status
      const orderStatus = page.locator('[data-testid="order-status-dropdown"], select[name="orderStatus"]');
      await expect(orderStatus).toHaveValue('processing');

      // Submit the last remaining service
      await page.click('[data-testid="last-service-link"]');
      const serviceStatus = page.locator('[data-testid="service-status-dropdown"]');
      await serviceStatus.selectOption('submitted');

      // Go back to order details
      await page.click('[data-testid="back-to-order"]');

      // Order should remain in processing (not auto-changed)
      await expect(orderStatus).toHaveValue('processing');

      // Verify no automatic status change in history
      const statusHistory = page.locator('[data-testid="status-history"]');
      await expect(statusHistory).not.toContainText('Automatically updated');
    });

    test('order remains in current status if service changed back from submitted', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order that was auto-submitted
      await page.goto('/fulfillment/orders/auto-submitted-order');

      // Verify order is in submitted status
      const orderStatus = page.locator('[data-testid="order-status-dropdown"], select[name="orderStatus"]');
      await expect(orderStatus).toHaveValue('submitted');

      // Change one service back to processing
      await page.click('[data-testid="service-1-link"]');
      const serviceStatus = page.locator('[data-testid="service-status-dropdown"]');
      await serviceStatus.selectOption('processing');

      // Go back to order details
      await page.click('[data-testid="back-to-order"]');

      // Order should remain in submitted status (no auto-reversal)
      await expect(orderStatus).toHaveValue('submitted');
    });

    test('order with no services cannot auto-progress', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with no services
      await page.goto('/fulfillment/orders/empty-order');

      // Verify order is in draft status
      const orderStatus = page.locator('[data-testid="order-status-dropdown"], select[name="orderStatus"]');
      await expect(orderStatus).toHaveValue('draft');

      // Verify no services are listed
      await expect(page.locator('[data-testid="service-list"]')).toContainText('No services');

      // Order should remain in draft (cannot auto-progress)
      await expect(orderStatus).toHaveValue('draft');
    });
  });

  test.describe('Customer Read-Only View', () => {
    test('customer sees status as read-only text in left sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/customer-order-123');

      // Should see status as text, not dropdown
      const statusText = page.locator('[data-testid="order-status-text"], .order-status-text');
      await expect(statusText).toBeVisible();
      await expect(statusText).toContainText('Status: Processing');

      // Should NOT see dropdown
      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await expect(statusDropdown).not.toBeVisible();

      // Should see status history
      const statusHistory = page.locator('[data-testid="status-history"]');
      await expect(statusHistory).toBeVisible();
    });

    test('customer sees status history without user names for privacy', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with history
      await page.goto('/fulfillment/orders/customer-order-with-history');

      // Check status history
      const statusHistory = page.locator('[data-testid="status-history"]');
      await expect(statusHistory).toBeVisible();

      // Should see timestamps and status changes
      const historyEntries = statusHistory.locator('.history-entry');
      await expect(historyEntries).toHaveCount(3);

      // Should NOT see user names
      for (const entry of await historyEntries.all()) {
        await expect(entry).not.toContainText('@globalrx.com');
        await expect(entry).not.toContainText('internal@');
        // Should see timestamp
        await expect(entry).toContainText(/\d{2}\/\d{2}\/\d{4}/);
      }
    });
  });

  test.describe('Vendor Read-Only View', () => {
    test('vendor sees status as read-only text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@screening-corp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/vendor-order-123');

      // Should see status as text, not dropdown
      const statusText = page.locator('[data-testid="order-status-text"], .order-status-text');
      await expect(statusText).toBeVisible();
      await expect(statusText).toContainText('Status: Processing');

      // Should NOT see dropdown
      const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
      await expect(statusDropdown).not.toBeVisible();
    });

    test('vendor sees full status history with user names', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@screening-corp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with history
      await page.goto('/fulfillment/orders/vendor-order-with-history');

      // Check status history
      const statusHistory = page.locator('[data-testid="status-history"]');
      await expect(statusHistory).toBeVisible();

      // Should see user names in history (vendors can see who made changes)
      const firstEntry = statusHistory.locator('.history-entry').first();
      await expect(firstEntry).toContainText('internal@globalrx.com');
    });
  });

  test.describe('Status History Display', () => {
    test('status history shows entries in chronological order with newest first', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with multiple history entries
      await page.goto('/fulfillment/orders/order-with-long-history');

      // Check status history order
      const statusHistory = page.locator('[data-testid="status-history"]');
      const entries = statusHistory.locator('.history-entry');

      // Get all timestamps
      const timestamps = await entries.evaluateAll((elements) => {
        return elements.map(el => {
          const timestampText = el.querySelector('.timestamp')?.textContent || '';
          return new Date(timestampText).getTime();
        });
      });

      // Verify descending order (newest first)
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThan(timestamps[i]);
      }
    });

    test('shows initial status creation with null fromStatus', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to new order
      await page.goto('/fulfillment/orders/new-order');

      // Check the last history entry (should be initial)
      const statusHistory = page.locator('[data-testid="status-history"]');
      const lastEntry = statusHistory.locator('.history-entry').last();

      // Should show transition from nothing to draft
      await expect(lastEntry).toContainText('Created as draft');
      // Should NOT show "from null" or similar
      await expect(lastEntry).not.toContainText('null');
    });
  });

  test.describe('Edge Cases', () => {
    test('handles order deletion while viewing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/deletable-order');

      // Intercept next API call to simulate order deletion
      await page.route('**/api/fulfillment/orders/deletable-order/status', route => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Order not found' })
        });
      });

      // Try to change status
      const statusDropdown = page.locator('[data-testid="order-status-dropdown"]');
      await statusDropdown.selectOption('processing');

      // Should show error and redirect
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('Order not found');

      // Should redirect to orders list
      await page.waitForURL('/fulfillment/orders');
    });

    test('handles user permission loss mid-session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Intercept next API call to simulate permission loss
      await page.route('**/api/fulfillment/orders/*/status', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'You no longer have permission to update order status' })
        });
      });

      // Try to change status
      const statusDropdown = page.locator('[data-testid="order-status-dropdown"]');
      await statusDropdown.selectOption('completed');

      // Should show permission error
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('You no longer have permission to update order status');

      // Dropdown should revert
      await expect(statusDropdown).toHaveValue('draft');
    });

    test('page refreshes correctly during status update', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Change status
      const statusDropdown = page.locator('[data-testid="order-status-dropdown"]');
      await statusDropdown.selectOption('processing');

      // Immediately refresh page
      await page.reload();

      // Should show the new status after refresh
      await expect(statusDropdown).toHaveValue('processing');

      // History should include the change
      const statusHistory = page.locator('[data-testid="status-history"]');
      const firstEntry = statusHistory.locator('.history-entry').first();
      await expect(firstEntry).toContainText('processing');
    });
  });
});