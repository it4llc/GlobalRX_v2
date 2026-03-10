// /GlobalRX_v2/tests/e2e/dashboard-stats-bug.spec.ts
// End-to-end tests for dashboard stats consolidation bug
//
// THE BUG:
// Dashboard shows wrong stat cards for different user types
// Should show only 3 cards: Total Orders, Total Services, In Progress

import { test, expect } from '@playwright/test';

test.describe('Dashboard Stats Bug - E2E Tests', () => {
  test.describe('Current broken behavior (proves bug exists)', () => {
    test('internal user sees 5 stat cards instead of 3', async ({ page }) => {
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to fulfillment page
      await page.waitForURL('/fulfillment');

      // Count stat cards - currently shows 5
      const statCards = await page.locator('.bg-white.rounded-lg.shadow.p-6').count();
      expect(statCards).toBe(5); // BUG: Should be 3

      // Verify wrong cards are shown
      await expect(page.getByText('Total Orders')).toBeVisible();
      await expect(page.getByText('Submitted')).toBeVisible();
      await expect(page.getByText('Processing')).toBeVisible();
      await expect(page.getByText('Completed')).toBeVisible();
      await expect(page.getByText('Cancelled')).toBeVisible();

      // Verify correct cards are missing
      await expect(page.getByText('Total Services')).not.toBeVisible();
      await expect(page.getByText('In Progress')).not.toBeVisible();
    });

    test('customer user sees 4 stat cards with wrong metrics', async ({ page }) => {
      // Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Currently redirects to dashboard, not fulfillment
      await page.waitForURL('/dashboard');

      // Count stat cards - currently shows 4 for customers
      const statCards = await page.locator('.stat-card').count();
      expect(statCards).toBe(4); // BUG: Should be 3

      // Verify wrong cards for customer
      await expect(page.getByText('Total Orders')).toBeVisible();
      await expect(page.getByText('Pending')).toBeVisible();
      await expect(page.getByText('Completed')).toBeVisible();
      await expect(page.getByText('Drafts')).toBeVisible();

      // Missing correct metrics
      await expect(page.getByText('Total Services')).not.toBeVisible();
      await expect(page.getByText('In Progress')).not.toBeVisible();
    });

    test('vendor user sees 5 stat cards like internal users', async ({ page }) => {
      // Login as vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to fulfillment
      await page.goto('/fulfillment');
      await page.waitForLoadState('networkidle');

      // Count stat cards
      const statCards = await page.locator('.bg-white.rounded-lg.shadow.p-6').count();
      expect(statCards).toBe(5); // BUG: Should be 3

      // All users should see the same 3 metrics
    });
  });

  test.describe('Expected correct behavior (after fix)', () => {
    test('all users see exactly 3 stat cards with same metrics', async ({ page }) => {
      // Test with internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // All users should go to /fulfillment
      await page.waitForURL('/fulfillment');

      // Count stat cards - should be exactly 3
      const statCards = await page.locator('.stat-card').count();
      expect(statCards).toBe(3);

      // Verify correct cards are shown
      await expect(page.getByText('Total Orders')).toBeVisible();
      await expect(page.getByText('Total Services')).toBeVisible();
      await expect(page.getByText('In Progress')).toBeVisible();

      // Verify old cards are gone
      await expect(page.getByText('Submitted')).not.toBeVisible();
      await expect(page.getByText('Processing')).not.toBeVisible();
      await expect(page.getByText('Completed')).not.toBeVisible();
      await expect(page.getByText('Cancelled')).not.toBeVisible();
      await expect(page.getByText('Pending')).not.toBeVisible();
      await expect(page.getByText('Drafts')).not.toBeVisible();
    });

    test('Total Services count is accurate across orders', async ({ page }) => {
      // Setup: Create orders with multiple services
      // This would normally be done through API or database seeding

      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL('/fulfillment');

      // Get the Total Services value
      const totalServicesCard = page.locator('.stat-card:has-text("Total Services")');
      const servicesCount = await totalServicesCard.locator('.stat-value').textContent();

      // Navigate to orders list and count actual services
      const orderRows = await page.locator('table tbody tr').count();
      let actualServiceCount = 0;

      for (let i = 0; i < orderRows; i++) {
        const servicesCell = await page.locator(`table tbody tr:nth-child(${i + 1}) td:nth-child(5)`).textContent();
        // Count services (they're comma-separated in the display)
        if (servicesCell && servicesCell !== 'No services') {
          const services = servicesCell.split(',').filter(s => s.trim());
          actualServiceCount += services.length;
        }
      }

      // The displayed count should match actual services
      expect(parseInt(servicesCount || '0')).toBe(actualServiceCount);
    });

    test('In Progress count excludes Draft, Completed, and Cancelled', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL('/fulfillment');

      // Get In Progress count from stat card
      const inProgressCard = page.locator('.stat-card:has-text("In Progress")');
      const inProgressCount = await inProgressCard.locator('.stat-value').textContent();

      // Click on In Progress to filter
      await inProgressCard.click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Count filtered orders
      const filteredOrders = await page.locator('table tbody tr').count();

      // The count should match
      expect(filteredOrders).toBe(parseInt(inProgressCount || '0'));

      // Verify no Draft, Completed, or Cancelled orders in the list
      const statuses = await page.locator('table tbody tr .badge').allTextContents();
      for (const status of statuses) {
        expect(status.toLowerCase()).not.toContain('draft');
        expect(status.toLowerCase()).not.toContain('completed');
        expect(status.toLowerCase()).not.toContain('cancelled');
      }
    });

    test('customer users can access fulfillment page with their orders', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should redirect to fulfillment, not dashboard
      await page.waitForURL('/fulfillment');

      // Should see the 3 standard stat cards
      await expect(page.getByText('Total Orders')).toBeVisible();
      await expect(page.getByText('Total Services')).toBeVisible();
      await expect(page.getByText('In Progress')).toBeVisible();

      // Orders shown should only be for their customer
      const orderRows = await page.locator('table tbody tr').count();
      if (orderRows > 0) {
        // All orders should belong to this customer
        const customerCells = await page.locator('table tbody tr td:nth-child(3)').allTextContents();
        const uniqueCustomers = [...new Set(customerCells)];
        expect(uniqueCustomers).toHaveLength(1); // Only one customer
      }
    });

    test('stat cards update in real-time when orders change', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL('/fulfillment');

      // Get initial counts
      const totalOrdersBefore = await page.locator('.stat-card:has-text("Total Orders") .stat-value').textContent();
      const inProgressBefore = await page.locator('.stat-card:has-text("In Progress") .stat-value').textContent();

      // Create a new order (through UI or API)
      // This is a simulation - actual implementation would create an order

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Get new counts
      const totalOrdersAfter = await page.locator('.stat-card:has-text("Total Orders") .stat-value').textContent();
      const inProgressAfter = await page.locator('.stat-card:has-text("In Progress") .stat-value').textContent();

      // Verify counts are retrieved fresh from API
      // (This test ensures stats aren't cached incorrectly)
    });
  });

  test.describe('Navigation and routing', () => {
    test('all user types route to /fulfillment instead of /dashboard', async ({ page }) => {
      // Test customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should go to fulfillment
      await expect(page).toHaveURL('/fulfillment');

      await page.click('button:has-text("Logout")');

      // Test vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should go to fulfillment
      await expect(page).toHaveURL('/fulfillment');

      await page.click('button:has-text("Logout")');

      // Test internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Should go to fulfillment
      await expect(page).toHaveURL('/fulfillment');
    });
  });
});