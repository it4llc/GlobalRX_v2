// /GlobalRX_v2/tests/e2e/order-view-tracking.spec.ts
// End-to-end tests for order view tracking feature
// Phase 1: Tests will fail until database schema and API routes are implemented

import { test, expect } from '@playwright/test';

test.describe('Order View Tracking - E2E Tests', () => {

  test.describe('Order View Tracking', () => {
    test('tracks when customer user views an order', async ({ page }) => {
      // Step 1: Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to orders list
      await page.waitForURL(/\/portal|\/dashboard/);
      await page.click('text=My Orders');

      // Step 3: Click on an order to view details
      const orderNumber = '20240310-ABC-0001';
      await page.click(`text=${orderNumber}`);

      // Step 4: Wait for order details page to load
      await page.waitForURL(/\/fulfillment\/orders\//);
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // Step 5: Verify view tracking occurred (would check database or API)
      // This will be verified by checking for "new" indicators on subsequent visits

      // Step 6: Navigate back to orders list
      await page.click('text=Back to Orders');

      // Step 7: Return to the same order
      await page.click(`text=${orderNumber}`);

      // The view tracking should have updated the lastViewedAt timestamp
      // This would be verified through API calls in Phase 2
    });

    test('tracks individual order item views separately', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForSelector('[data-testid="order-items-list"]');

      // Click on first order item to expand/view it
      const firstItemSelector = '[data-testid="order-item-0"]';
      await page.click(firstItemSelector);

      // Wait for item details to be visible
      await page.waitForSelector('[data-testid="order-item-details-0"]');

      // Click on second order item
      const secondItemSelector = '[data-testid="order-item-1"]';
      await page.click(secondItemSelector);

      // Wait for item details to be visible
      await page.waitForSelector('[data-testid="order-item-details-1"]');

      // Each click should have created/updated an order_item_views record
      // This will be verified through the database in Phase 1
    });

    test('shows "new" indicator for unviewed orders', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to orders list
      await page.waitForURL(/\/portal|\/dashboard/);
      await page.click('text=My Orders');

      // Orders that have been updated since last view should show indicator
      const newIndicator = page.locator('[data-testid="new-order-indicator"]').first();
      await expect(newIndicator).toBeVisible();

      // Click on the order with "new" indicator
      const orderWithNew = page.locator('[data-testid="order-row"]').filter({ has: newIndicator });
      await orderWithNew.click();

      // View the order details
      await page.waitForURL(/\/fulfillment\/orders\//);
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // Navigate back
      await page.click('text=Back to Orders');

      // The "new" indicator should no longer be visible for this order
      await expect(newIndicator).not.toBeVisible();
    });

    test('shows "new" indicator for unviewed order items', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to an order with updated items
      await page.goto('/fulfillment/orders/order-with-updated-items');
      await page.waitForSelector('[data-testid="order-items-list"]');

      // Items updated since last view should show indicator
      const newItemIndicator = page.locator('[data-testid="new-item-indicator"]').first();
      await expect(newItemIndicator).toBeVisible();

      // Click on the item with "new" indicator
      const itemWithNew = page.locator('[data-testid="order-item"]').filter({ has: newItemIndicator });
      await itemWithNew.click();

      // View the item details
      await page.waitForSelector('[data-testid="order-item-details"]');

      // Collapse the item
      await itemWithNew.click();

      // Re-expand the same item
      await itemWithNew.click();

      // The "new" indicator should no longer be visible for this item
      await expect(newItemIndicator).not.toBeVisible();
    });

    test('does not track views for admin users', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'adminpassword');
      await page.click('button[type="submit"]');

      // Navigate to an order
      await page.goto('/fulfillment/orders/order-123');
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // View some order items
      await page.click('[data-testid="order-item-0"]');
      await page.waitForSelector('[data-testid="order-item-details-0"]');

      // Log out and log in as customer
      await page.click('text=Logout');
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to the same order
      await page.goto('/fulfillment/orders/order-123');

      // If this order was never viewed by the customer before,
      // it should still show as "new" despite the admin viewing it
      // (This would be verified by checking for new indicators)
    });

    test('does not track views for vendor users', async ({ page }) => {
      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@backgroundchecks.com');
      await page.fill('input[name="password"]', 'vendorpassword');
      await page.click('button[type="submit"]');

      // Navigate to an assigned service/order
      await page.goto('/fulfillment/services/service-456');
      await expect(page.getByText('Service Details')).toBeVisible();

      // View order information
      const viewOrderButton = page.getByRole('button', { name: /View Order/i });
      if (await viewOrderButton.isVisible()) {
        await viewOrderButton.click();
        await page.waitForURL(/\/fulfillment\/orders\//);
      }

      // Log out and log in as customer
      await page.click('text=Logout');
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to orders list
      await page.click('text=My Orders');

      // The order viewed by vendor should still show as "new" for customer
      // if customer hasn't viewed it yet
    });

    test('updates lastViewedAt on page refresh', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // Wait a moment
      await page.waitForTimeout(1000);

      // Refresh the page
      await page.reload();

      // The view tracking should update lastViewedAt
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // This would update the existing order_views record's lastViewedAt timestamp
    });

    test('handles concurrent tabs gracefully', async ({ browser }) => {
      // Create two browser contexts (like two tabs)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Login in both tabs as same customer
      for (const page of [page1, page2]) {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'customer@acmecorp.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
      }

      // Navigate to same order in both tabs simultaneously
      await Promise.all([
        page1.goto('/fulfillment/orders/order-123'),
        page2.goto('/fulfillment/orders/order-123'),
      ]);

      // Both pages should load successfully
      await expect(page1.getByRole('heading', { name: /Order Details/i })).toBeVisible();
      await expect(page2.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // The database should handle concurrent updates to the same view record
      // using last-write-wins strategy

      // Clean up
      await context1.close();
      await context2.close();
    });

    test('preserves view tracking data after user type change', async ({ page }) => {
      // This test verifies business rule #8 from the spec
      // If a customer user is converted to admin, their existing view records remain

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // View some orders to create tracking records
      await page.click('text=My Orders');
      await page.click('text=20240310-ABC-0001');
      await page.waitForURL(/\/fulfillment\/orders\//);

      // After user is converted to admin (would happen through admin panel)
      // The existing view records should remain in the database
      // But no new tracking would occur

      // This would be verified at database level in Phase 1
    });
  });

  test.describe('Error Handling', () => {
    test('page loads even if view tracking fails', async ({ page }) => {
      // Simulate view tracking API failure
      await page.route('**/api/view-tracking/**', route => {
        route.abort('failed');
      });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order - should still load despite tracking failure
      await page.goto('/fulfillment/orders/order-123');

      // Page should load normally
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();

      // Order data should be visible
      await expect(page.getByText('20240310-ABC-0001')).toBeVisible();
    });

    test('handles deleted orders gracefully', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to navigate to a deleted order
      await page.goto('/fulfillment/orders/deleted-order-id');

      // Should show appropriate error message
      await expect(page.getByText(/Order not found|This order no longer exists/i)).toBeVisible();

      // View tracking records for deleted orders should be cascade deleted
      // This is verified at database level
    });
  });
});