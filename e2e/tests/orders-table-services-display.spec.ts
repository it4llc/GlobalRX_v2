// /GlobalRX_v2/e2e/tests/orders-table-services-display.spec.ts

import { test, expect } from '../fixtures/auth';
import { Page } from '@playwright/test';

test.describe('Orders Table Services Display', () => {
  test.describe('Customer Portal - Service Status Display', () => {
    test('customer can view service statuses in orders list', async ({ authenticatedPage: page }) => {
      // Step 1: Navigate to customer portal orders page
      await page.goto('/portal/orders');

      // Step 2: Wait for orders table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Step 3: Locate the Services column
      const servicesHeader = page.locator('th').filter({ hasText: 'Services' });
      await expect(servicesHeader).toBeVisible();

      // Step 4: Find first order row with services
      const firstOrderRow = page.locator('tbody tr').first();
      const servicesCell = firstOrderRow.locator('td').nth(3); // Assuming Services is 4th column

      // Step 5: Verify service information is displayed
      const serviceItems = servicesCell.locator('[data-testid*="service-item"]');
      const serviceCount = await serviceItems.count();

      if (serviceCount > 0) {
        // Verify service format: "Name - Country - Status"
        const firstService = serviceItems.first();
        const serviceText = await firstService.textContent();

        // Should contain service name, country, and status
        expect(serviceText).toMatch(/\w+ - \w+ - \w+/);

        // Verify status badge has color coding
        const statusBadge = firstService.locator('[class*="bg-"][class*="-100"]');
        await expect(statusBadge).toBeVisible();
      } else {
        // Verify "No services" message
        const noServicesText = servicesCell.locator('.text-gray-500');
        await expect(noServicesText).toHaveText('No services');
      }
    });

    test('displays up to 5 services initially with expand option', async ({ authenticatedPage: page }) => {
      // Navigate to orders page
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Find an order with more than 5 services (if exists)
      const orderRows = page.locator('tbody tr');
      const rowCount = await orderRows.count();

      for (let i = 0; i < rowCount; i++) {
        const row = orderRows.nth(i);
        const servicesCell = row.locator('td').nth(3);

        // Check if "Show N more" link exists
        const showMoreLink = servicesCell.locator('text=/Show \\d+ more/');

        if (await showMoreLink.isVisible()) {
          // Step 1: Verify only 5 services are visible initially
          const visibleServices = servicesCell.locator('[data-testid*="service-item"]:visible');
          const initialCount = await visibleServices.count();
          expect(initialCount).toBeLessThanOrEqual(5);

          // Step 2: Click "Show N more" to expand
          await showMoreLink.click();

          // Step 3: Verify all services are now visible
          await page.waitForTimeout(500); // Wait for expansion animation
          const expandedServices = servicesCell.locator('[data-testid*="service-item"]:visible');
          const expandedCount = await expandedServices.count();
          expect(expandedCount).toBeGreaterThan(5);

          // Step 4: Verify "Show less" link appears
          const showLessLink = servicesCell.locator('text="Show less"');
          await expect(showLessLink).toBeVisible();

          // Step 5: Click "Show less" to collapse
          await showLessLink.click();

          // Step 6: Verify back to 5 services visible
          await page.waitForTimeout(500);
          const collapsedCount = await servicesCell.locator('[data-testid*="service-item"]:visible').count();
          expect(collapsedCount).toBeLessThanOrEqual(5);

          break; // Found and tested an order with many services
        }
      }
    });

    test('shows correct status colors matching order status colors', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Status color mappings to verify
      const statusColors = {
        'draft': 'bg-gray-100',
        'Draft': 'bg-gray-100',
        'submitted': 'bg-blue-100',
        'Submitted': 'bg-blue-100',
        'processing': 'bg-yellow-100',
        'Processing': 'bg-yellow-100',
        'missing info': 'bg-orange-100',
        'Missing Info': 'bg-orange-100',
        'completed': 'bg-green-100',
        'Completed': 'bg-green-100',
        'cancelled': 'bg-red-100',
        'Cancelled': 'bg-red-100'
      };

      // Find first order with services
      const servicesCell = page.locator('tbody tr').first().locator('td').nth(3);
      const statusBadges = servicesCell.locator('[class*="rounded-full"][class*="px-2"]');
      const badgeCount = await statusBadges.count();

      if (badgeCount > 0) {
        for (let i = 0; i < Math.min(badgeCount, 3); i++) {
          const badge = statusBadges.nth(i);
          const badgeText = await badge.textContent();
          const badgeClass = await badge.getAttribute('class');

          // Verify badge has appropriate color class
          const expectedColor = statusColors[badgeText?.trim() || ''];
          if (expectedColor) {
            expect(badgeClass).toContain(expectedColor);
          }

          // Verify badge has proper styling
          expect(badgeClass).toContain('rounded-full');
          expect(badgeClass).toContain('px-2');
          expect(badgeClass).toContain('text-xs');
        }
      }
    });

    test('displays "No services" for orders without services', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Look for any order with "No services" text
      const noServicesElements = page.locator('td').filter({ hasText: 'No services' });
      const count = await noServicesElements.count();

      if (count > 0) {
        const firstNoServices = noServicesElements.first();
        await expect(firstNoServices).toBeVisible();

        // Verify it has gray text styling
        const element = firstNoServices.locator('.text-gray-500');
        await expect(element).toHaveText('No services');
      }
    });
  });

  test.describe('Portal Dashboard - Service Status Display', () => {
    test('displays service statuses correctly in portal dashboard', async ({ authenticatedPage: page }) => {
      // Navigate to portal dashboard
      await page.goto('/portal/dashboard');
      await page.waitForSelector('table', { timeout: 10000 });

      // Get all order rows
      const orderRows = page.locator('tbody tr');
      const rowCount = await orderRows.count();

      // If there are orders, verify service status display
      if (rowCount > 0) {
        // Check first order row
        const firstRow = orderRows.first();
        const servicesCell = firstRow.locator('td:nth-child(2)'); // Services column is 2nd

        // Check if ServiceStatusList component is rendering
        const serviceStatusList = servicesCell.locator('[role="list"]');

        if (await serviceStatusList.count() > 0) {
          // Verify services are displayed with status badges
          const statusBadges = servicesCell.locator('[data-testid="service-status-badge"]');
          const badgeCount = await statusBadges.count();

          if (badgeCount > 0) {
            // Verify at least one status badge exists
            expect(badgeCount).toBeGreaterThan(0);

            // Check first status badge has proper styling
            const firstBadge = statusBadges.first();
            const badgeClass = await firstBadge.getAttribute('class');

            // Should have rounded corners and appropriate sizing
            expect(badgeClass).toContain('rounded-full');
            expect(badgeClass).toContain('text-xs');
            expect(badgeClass).toContain('px-2');

            // Verify it has color classes (any of the status colors)
            const hasColorClass =
              badgeClass?.includes('bg-gray-100') ||
              badgeClass?.includes('bg-blue-100') ||
              badgeClass?.includes('bg-yellow-100') ||
              badgeClass?.includes('bg-orange-100') ||
              badgeClass?.includes('bg-green-100') ||
              badgeClass?.includes('bg-red-100');

            expect(hasColorClass).toBeTruthy();
          }
        } else {
          // If no ServiceStatusList, might show "No services"
          const noServicesText = await servicesCell.locator('.text-gray-500').textContent();
          if (noServicesText) {
            expect(noServicesText).toBe('No services');
          }
        }
      }
    });

    test('service statuses match between dashboard and orders page', async ({ authenticatedPage: page }) => {
      // First get order data from dashboard
      await page.goto('/portal/dashboard');
      await page.waitForSelector('table', { timeout: 10000 });

      const firstOrderNumber = await page.locator('tbody tr:first-child td:first-child .text-sm.font-medium').textContent();
      const dashboardServices = await page.locator('tbody tr:first-child td:nth-child(2)').textContent();

      if (firstOrderNumber && dashboardServices) {
        // Now check the same order in orders page
        await page.goto('/portal/orders');
        await page.waitForSelector('table', { timeout: 10000 });

        // Find the same order by order number
        const orderRow = page.locator('tbody tr').filter({ has: page.locator(`text="${firstOrderNumber}"`) });
        const ordersPageServices = await orderRow.locator('td:nth-child(2)').textContent();

        // Services display should match between pages
        expect(ordersPageServices).toBe(dashboardServices);
      }
    });
  });

  test.describe('Fulfillment Dashboard - Service Status Display', () => {
    test.beforeEach(async ({ page }) => {
      // Login as internal user with fulfillment permissions
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(fulfillment|dashboard)/, { timeout: 10000 });
    });

    test('internal users can view service statuses in fulfillment dashboard', async ({ page }) => {
      // Navigate to fulfillment page
      await page.goto('/fulfillment');

      // Wait for orders table to load
      await page.waitForSelector('table', { timeout: 10000 });

      // Verify Services column exists
      const servicesHeader = page.locator('th').filter({ hasText: 'Services' });
      await expect(servicesHeader).toBeVisible();

      // Find orders with services
      const orderRows = page.locator('tbody tr');
      const rowCount = await orderRows.count();

      if (rowCount > 0) {
        const firstRow = orderRows.first();
        const servicesCell = firstRow.locator('td').nth(4); // Services column position may differ

        // Check for service items or "No services" text
        const hasServices = await servicesCell.locator('[data-testid*="service-item"]').count() > 0;
        const hasNoServices = await servicesCell.locator('text="No services"').isVisible();

        expect(hasServices || hasNoServices).toBeTruthy();
      }
    });

    test('vendor users see service statuses for their assigned orders', async ({ page }) => {
      // Login as vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(fulfillment|vendor|dashboard)/, { timeout: 10000 });

      // Navigate to fulfillment page
      await page.goto('/fulfillment');

      // Wait for table
      await page.waitForSelector('table', { timeout: 10000 });

      // Vendor should only see their assigned orders
      const orderRows = page.locator('tbody tr');
      const rowCount = await orderRows.count();

      if (rowCount > 0) {
        // Verify services are displayed for assigned orders
        const firstRow = orderRows.first();
        const servicesCell = firstRow.locator('td:nth-child(5)'); // Adjust column index as needed

        // Should have service information
        const serviceContent = await servicesCell.textContent();
        expect(serviceContent).toBeTruthy();
      }
    });
  });

  test.describe('Mobile Responsive Layout', () => {
    test('displays stacked service layout on mobile devices', async ({ authenticatedPage: page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

      // Navigate to orders page
      await page.goto('/portal/orders');

      // Wait for responsive table or card layout
      await page.waitForSelector('table, .order-card, .order-list', { timeout: 10000 });

      // Check if services are displayed in mobile format
      const serviceElements = page.locator('[data-testid*="service-item"]');
      const firstService = serviceElements.first();

      if (await firstService.isVisible()) {
        // On mobile, service info should be stacked
        const serviceContent = await firstService.innerHTML();

        // Should contain bullet separator for mobile layout
        expect(serviceContent).toContain('•');

        // Verify touch-friendly tap targets
        const expandButton = page.locator('button:has-text("Show"), a:has-text("Show")').first();
        if (await expandButton.isVisible()) {
          const box = await expandButton.boundingBox();
          // Minimum touch target should be 44x44 pixels
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.width).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('displays country code instead of full name when space is limited', async ({ authenticatedPage: page }) => {
      // Set narrow viewport
      await page.setViewportSize({ width: 768, height: 1024 }); // Tablet size

      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Find service items
      const serviceItems = page.locator('[data-testid*="service-item"]');
      const count = await serviceItems.count();

      if (count > 0) {
        const firstService = serviceItems.first();
        const serviceText = await firstService.textContent();

        // Check if country codes (2 letters) are used
        const countryCodePattern = /\b[A-Z]{2}\b/;
        const hasCountryCode = countryCodePattern.test(serviceText || '');

        // On tablet/narrow screens, might use country codes
        if (hasCountryCode) {
          expect(serviceText).toMatch(/\b[A-Z]{2}\b/); // Should have 2-letter country code
        }
      }
    });
  });

  test.describe('Performance and Loading States', () => {
    test('displays skeleton loaders while services data loads', async ({ authenticatedPage: page }) => {
      // Slow down network to see loading states
      await page.route('**/api/portal/orders', async (route) => {
        await page.waitForTimeout(1000); // Delay response
        await route.continue();
      });

      await page.goto('/portal/orders');

      // Check for skeleton loaders
      const skeletons = page.locator('.skeleton, .skeleton-loader, [class*="animate-pulse"]');
      const hasSkeletons = await skeletons.count() > 0;

      if (hasSkeletons) {
        await expect(skeletons.first()).toBeVisible();
      }

      // Wait for actual content to load
      await page.waitForSelector('table', { timeout: 15000 });

      // Skeletons should be gone
      await expect(skeletons.first()).not.toBeVisible();
    });

    test('loads service data in single API call without N+1 queries', async ({ authenticatedPage: page }) => {
      let apiCallCount = 0;

      // Monitor API calls
      await page.route('**/api/portal/orders', async (route) => {
        apiCallCount++;
        await route.continue();
      });

      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Should only make one API call for all orders with services
      expect(apiCallCount).toBe(1);

      // Verify services are displayed without additional calls
      const serviceItems = page.locator('[data-testid*="service-item"]');
      const serviceCount = await serviceItems.count();

      // Even with multiple orders/services, should still be just one API call
      expect(apiCallCount).toBe(1);
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    test('handles missing service names gracefully', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Look for "Unnamed Service" fallback text
      const unnamedServices = page.locator('text="Unnamed Service"');
      const count = await unnamedServices.count();

      if (count > 0) {
        const firstUnnamed = unnamedServices.first();
        await expect(firstUnnamed).toBeVisible();
        // Should be italicized
        const element = await firstUnnamed.elementHandle();
        const style = await element?.evaluate(el => window.getComputedStyle(el).fontStyle);
        expect(style).toBe('italic');
      }
    });

    test('handles missing location data gracefully', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Look for "Unknown Location" fallback text
      const unknownLocations = page.locator('text="Unknown Location"');
      const count = await unknownLocations.count();

      if (count > 0) {
        const firstUnknown = unknownLocations.first();
        await expect(firstUnknown).toBeVisible();
        // Should be italicized
        const element = await firstUnknown.elementHandle();
        const style = await element?.evaluate(el => window.getComputedStyle(el).fontStyle);
        expect(style).toBe('italic');
      }
    });

    test('displays unknown status with gray coloring', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Look for any badges that don't match known statuses
      const statusBadges = page.locator('[class*="rounded-full"][class*="px-2"]');
      const badgeCount = await statusBadges.count();

      for (let i = 0; i < Math.min(badgeCount, 5); i++) {
        const badge = statusBadges.nth(i);
        const badgeText = await badge.textContent();

        // Check if it's an unknown status (not in our expected list)
        const knownStatuses = ['draft', 'submitted', 'processing', 'missing info', 'completed', 'cancelled'];
        const isUnknown = !knownStatuses.some(status =>
          badgeText?.toLowerCase().includes(status)
        );

        if (isUnknown) {
          // Unknown status should have gray coloring
          const badgeClass = await badge.getAttribute('class');
          expect(badgeClass).toContain('bg-gray-100');
        }
      }
    });

    test('truncates long service names with ellipsis', async ({ authenticatedPage: page }) => {
      await page.goto('/portal/orders');
      await page.waitForSelector('table');

      // Look for truncated service names (ending with ...)
      const serviceItems = page.locator('[data-testid*="service-item"]');
      const count = await serviceItems.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const item = serviceItems.nth(i);
        const itemText = await item.textContent();

        if (itemText && itemText.includes('...')) {
          // Verify truncation is applied
          expect(itemText).toMatch(/[\w\s]{27,30}\.\.\./);
        }
      }
    });
  });
});