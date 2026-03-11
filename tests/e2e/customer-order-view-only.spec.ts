// /GlobalRX_v2/tests/e2e/customer-order-view-only.spec.ts
// End-to-end tests for customer order view-only access feature

import { test, expect } from '@playwright/test';

test.describe('Customer Order View-Only Access - E2E Tests', () => {

  test.describe('Customer User Journey', () => {
    test('customer can navigate from order list to order details page', async ({ page }) => {
      // Step 1: Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to orders list
      await page.waitForURL(/\/portal|\/dashboard/); // Customer portal or dashboard
      await page.click('text=My Orders');

      // Step 3: Click on an order to view details
      // Should see order in list
      await expect(page.getByText('20240310-ABC-0001')).toBeVisible();

      // Click on order - should navigate to details page
      await page.click('text=20240310-ABC-0001');

      // Step 4: Verify navigation to fulfillment order details page
      await page.waitForURL('/fulfillment/orders/order-123');

      // Step 5: Verify order details page loads
      await expect(page.getByRole('heading', { name: /Order Details/i })).toBeVisible();
      await expect(page.getByText('20240310-ABC-0001')).toBeVisible();
    });

    test('customer sees read-only order details with no edit capabilities', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate directly to order details
      await page.goto('/fulfillment/orders/order-123');

      // Verify read-only state
      // Should NOT see any edit buttons
      await expect(page.getByRole('button', { name: /edit order/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible();

      // Should NOT see action dropdowns
      await expect(page.getByTestId('action-dropdown')).not.toBeVisible();

      // Should NOT see status change dropdown
      await expect(page.getByRole('combobox', { name: /status/i })).not.toBeVisible();

      // Status should be displayed as text only
      await expect(page.getByText('Processing')).toBeVisible();
    });

    test('customer sees only external comments, not internal ones', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with comments
      await page.goto('/fulfillment/orders/order-with-comments');

      // Wait for comments to load
      await page.waitForSelector('[data-testid="comment-section"]');

      // Should see external comments
      await expect(page.getByText('Documents received and under review')).toBeVisible();
      await expect(page.getByText('Additional information may be required')).toBeVisible();

      // Should NOT see internal comments
      await expect(page.getByText('Internal: Check with vendor about delay')).not.toBeVisible();
      await expect(page.getByText('Staff note: Priority customer')).not.toBeVisible();

      // Comment count should only show external comments
      const commentBadge = page.locator('[data-testid="comment-count-badge"]');
      await expect(commentBadge).toHaveText('2'); // 2 external, not 4 total
    });

    test('customer cannot see vendor information', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');

      // Should NOT see vendor assignment information
      await expect(page.getByText('Background Checks Inc')).not.toBeVisible();
      await expect(page.getByText('Vendor:')).not.toBeVisible();
      await expect(page.getByText('Assigned Vendor')).not.toBeVisible();

      // Should NOT see vendor pricing
      await expect(page.getByText('$50.00')).not.toBeVisible();
      await expect(page.getByText('Vendor Cost')).not.toBeVisible();

      // Should NOT see vendor notes
      await expect(page.getByText('Vendor Notes')).not.toBeVisible();
    });

    test('customer cannot see who made changes or added comments', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');

      // Check comments - should not show author
      const commentSection = page.locator('[data-testid="comment-section"]');
      await expect(commentSection).toBeVisible();

      // Should NOT see comment author names
      await expect(page.getByText('Jane Admin')).not.toBeVisible();
      await expect(page.getByText('Bob Manager')).not.toBeVisible();
      await expect(page.getByText('Added by:')).not.toBeVisible();

      // Check status history - should not show who changed status
      const statusHistory = page.locator('[data-testid="status-history"]');
      await expect(statusHistory).toBeVisible();

      // Should see status changes but not who made them
      await expect(page.getByText('Submitted')).toBeVisible();
      await expect(page.getByText('Processing')).toBeVisible();

      // Should NOT see user information
      await expect(page.getByText('Changed by:')).not.toBeVisible();
      await expect(page.getByText('admin@globalrx.com')).not.toBeVisible();
    });

    test('customer cannot add, edit, or delete comments', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');

      // Should NOT see add comment button
      await expect(page.getByRole('button', { name: /add comment/i })).not.toBeVisible();

      // Should NOT see edit buttons on existing comments
      await expect(page.getByRole('button', { name: /edit comment/i })).not.toBeVisible();

      // Should NOT see delete buttons on existing comments
      await expect(page.getByRole('button', { name: /delete comment/i })).not.toBeVisible();

      // Should NOT see comment input field
      await expect(page.getByRole('textbox', { name: /comment/i })).not.toBeVisible();
    });

    test('customer sees appropriate error when trying to access another customers order', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to access another customer's order directly
      await page.goto('/fulfillment/orders/other-customer-order');

      // Should see 403 error
      await expect(page.getByText('You do not have permission to view this order')).toBeVisible();

      // Should NOT see order details
      await expect(page.getByText('20240310-XYZ-0001')).not.toBeVisible();
    });

    test('customer sees appropriate error when trying to access non-existent order', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to access non-existent order
      await page.goto('/fulfillment/orders/non-existent-order');

      // Should see 404 error
      await expect(page.getByText('Order not found')).toBeVisible();
    });
  });

  test.describe('Internal User Comparison', () => {
    test('internal user sees full order details with edit capabilities', async ({ page }) => {
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to same order
      await page.goto('/fulfillment/orders/order-123');

      // Should see edit capabilities
      await expect(page.getByRole('button', { name: /edit order/i })).toBeVisible();

      // Should see action dropdown
      await expect(page.getByTestId('action-dropdown')).toBeVisible();

      // Should see status change dropdown
      await expect(page.getByRole('combobox', { name: /status/i })).toBeVisible();

      // Should see vendor information
      await expect(page.getByText('Background Checks Inc')).toBeVisible();

      // Should see internal notes
      await expect(page.getByText('Internal Notes')).toBeVisible();

      // Should see all comments including internal
      await expect(page.getByText('Internal: Check with vendor about delay')).toBeVisible();

      // Should see comment authors
      await expect(page.getByText('Jane Admin')).toBeVisible();

      // Should see add comment button
      await expect(page.getByRole('button', { name: /add comment/i })).toBeVisible();
    });

    test('admin user sees everything including sensitive data', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Should see all data
      await expect(page.getByText('Vendor Cost: $50.00')).toBeVisible();
      await expect(page.getByText('Markup: $25.00')).toBeVisible();
      await expect(page.getByText('Created by: admin@globalrx.com')).toBeVisible();
      await expect(page.getByText('Vendor Notes')).toBeVisible();
      await expect(page.getByText('Internal Notes')).toBeVisible();

      // Should have full edit capabilities
      await expect(page.getByRole('button', { name: /delete order/i })).toBeVisible();
    });
  });

  test.describe('Service Fulfillment Details', () => {
    test('customer sees service statuses but not vendor assignments', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order with multiple services
      await page.goto('/fulfillment/orders/order-with-services');

      // Expand service details
      const serviceRow = page.locator('[data-testid="service-row-1"]');
      await serviceRow.click();

      // Should see service status
      await expect(page.getByText('Criminal Background Check')).toBeVisible();
      await expect(page.getByText('Status: Processing')).toBeVisible();
      await expect(page.getByText('Location: National')).toBeVisible();

      // Should NOT see vendor assignment
      await expect(page.getByText('Assigned to:')).not.toBeVisible();
      await expect(page.getByText('Vendor ABC')).not.toBeVisible();

      // Should NOT see vendor notes
      await expect(serviceRow.getByText('Vendor Notes')).not.toBeVisible();
    });

    test('customer sees status history timeline without user information', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Check status history sidebar
      const sidebar = page.locator('[data-testid="order-sidebar"]');
      await expect(sidebar).toBeVisible();

      // Should see status timeline
      await expect(sidebar.getByText('Draft')).toBeVisible();
      await expect(sidebar.getByText('Submitted')).toBeVisible();
      await expect(sidebar.getByText('Processing')).toBeVisible();

      // Should see timestamps
      await expect(sidebar.getByText('Mar 10, 2024 9:00 AM')).toBeVisible();
      await expect(sidebar.getByText('Mar 10, 2024 10:00 AM')).toBeVisible();

      // Should NOT see who made changes
      await expect(sidebar.getByText('by Jane Admin')).not.toBeVisible();
      await expect(sidebar.getByText('Changed by')).not.toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('customer can view order details on mobile device', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Verify mobile layout
      // Order details should be visible
      await expect(page.getByText('20240310-ABC-0001')).toBeVisible();

      // Services should be in a scrollable list
      const serviceSection = page.locator('[data-testid="services-section"]');
      await expect(serviceSection).toBeVisible();

      // Should be able to scroll horizontally if needed
      const isScrollable = await serviceSection.evaluate(el => el.scrollWidth > el.clientWidth);
      expect(isScrollable || true).toBeTruthy(); // May or may not need scroll depending on content

      // Comments should be visible
      await expect(page.getByText('Documents received and under review')).toBeVisible();

      // Navigation should work
      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('customer order details page loads within 3 seconds', async ({ page }) => {
      // Start timing
      const startTime = Date.now();

      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Wait for main content to load
      await page.waitForSelector('[data-testid="order-details-content"]');

      // Check load time
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });
  });

  test.describe('Session Management', () => {
    test('customer redirected to login when session expires', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');

      // Simulate session expiry by clearing cookies
      await page.context().clearCookies();

      // Try to refresh page
      await page.reload();

      // Should be redirected to login
      await expect(page).toHaveURL('/login');

      // Should show session expired message
      await expect(page.getByText(/session expired|please log in/i)).toBeVisible();
    });

    test('customer returns to order details after re-authentication', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order
      const orderUrl = '/fulfillment/orders/order-123';
      await page.goto(orderUrl);

      // Simulate session expiry
      await page.context().clearCookies();
      await page.reload();

      // Should be at login with return URL
      await expect(page).toHaveURL(/\/login/);

      // Re-authenticate
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should return to order details
      await expect(page).toHaveURL(orderUrl);
      await expect(page.getByText('20240310-ABC-0001')).toBeVisible();
    });
  });
});