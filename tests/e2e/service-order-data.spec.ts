// /GlobalRX_v2/tests/e2e/service-order-data.spec.ts
// End-to-end tests for the Service Order Data feature
//
// Feature: Include order data (form fields) in service details API response

import { test, expect } from '@playwright/test';

test.describe('Service Order Data Feature', () => {
  test.describe('Internal Fulfillment Team', () => {
    test('internal user can view order data for education verification service', async ({ page }) => {
      // User Flow Step 1: Navigate to fulfillment module
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // User Flow Step 2: Click on a specific service to view its details
      // Find an education verification service in the list
      const serviceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      // Wait for service details to load
      await page.waitForSelector('[data-testid="service-details"]');

      // User Flow Step 9: User sees service details with all collected order data
      // Business Rule 5: Field labels come from workflow configuration
      await expect(page.getByText('School Name')).toBeVisible();
      await expect(page.getByText('University of Michigan')).toBeVisible();

      await expect(page.getByText('Degree Type')).toBeVisible();
      await expect(page.getByText('Bachelor\'s')).toBeVisible();

      await expect(page.getByText('Graduation Date')).toBeVisible();
      await expect(page.getByText('2020-05-15')).toBeVisible();

      await expect(page.getByText('Major/Field of Study')).toBeVisible();
      await expect(page.getByText('Computer Science')).toBeVisible();

      // Business Rule 3: Subject Information fields should NOT be displayed
      await expect(page.getByText('First Name', { exact: true })).not.toBeVisible();
      await expect(page.getByText('Last Name', { exact: true })).not.toBeVisible();
      await expect(page.getByText('Email', { exact: true })).not.toBeVisible();
      await expect(page.getByText('Social Security Number')).not.toBeVisible();
    });

    test('internal user can view order data for employment verification service', async ({ page }) => {
      // Business Rule 1: Order data must be included for ALL service types
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find an employment verification service
      const serviceRow = page.locator('tr').filter({ hasText: 'Employment Verification' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Check employment-specific fields are displayed
      await expect(page.getByText('Company Name')).toBeVisible();
      await expect(page.getByText('Tech Corp')).toBeVisible();

      await expect(page.getByText('Position')).toBeVisible();
      await expect(page.getByText('Software Engineer')).toBeVisible();

      await expect(page.getByText('Employment Dates')).toBeVisible();
      await expect(page.getByText('2018-2022')).toBeVisible();

      // Subject fields should still be excluded
      await expect(page.getByText('dateOfBirth')).not.toBeVisible();
      await expect(page.getByText('ssn')).not.toBeVisible();
    });

    test('internal user sees empty order data section when no data exists', async ({ page }) => {
      // Edge Case 1: No order data exists
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find a service without order data (newer service)
      const serviceRow = page.locator('tr').filter({ hasText: 'Background Check' }).last();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Business Rule 8: If no order data exists, should show empty state
      const orderDataSection = page.locator('[data-testid="order-data-section"]');
      await expect(orderDataSection).toBeVisible();
      await expect(orderDataSection.getByText('No order data available')).toBeVisible();
    });
  });

  test.describe('Vendor Users', () => {
    test('vendor can view order data for assigned service', async ({ page }) => {
      // Business Rule 6: All users who can view a service can see all its order data fields
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@verification.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/vendor/dashboard');

      // Navigate to assigned services
      await page.click('a[href="/vendor/services"]');

      // Click on an assigned service
      const serviceRow = page.locator('tr').first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Vendor should see order data
      const orderDataSection = page.locator('[data-testid="order-data-section"]');
      await expect(orderDataSection).toBeVisible();

      // Check that order data fields are visible
      await expect(orderDataSection.getByText('School Name')).toBeVisible();
      await expect(orderDataSection.getByText('Degree Type')).toBeVisible();

      // Vendor should NOT see subject's personal information (already filtered by API)
      await expect(page.getByText('Customer Name')).not.toBeVisible();
      await expect(page.getByText('Customer Email')).not.toBeVisible();
    });

    test('vendor cannot access unassigned service order data', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@verification.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/vendor/dashboard');

      // Try to access a service directly that's not assigned to this vendor
      await page.goto('/vendor/services/unassigned-service-id');

      // Should show error or redirect
      await expect(page).toHaveURL('/vendor/dashboard');
      const errorMessage = page.getByText('You do not have permission to view this service');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Customer Users', () => {
    test('customer can view order data for their own services', async ({ page }) => {
      // Business Rule 6: All users who can view a service can see all its order data fields
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@company.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/portal/dashboard');

      // Navigate to orders
      await page.click('a[href="/portal/orders"]');

      // Click on an order
      const orderRow = page.locator('tr').first();
      await orderRow.click();

      // Click on a service within the order
      const serviceCard = page.locator('[data-testid="service-card"]').first();
      await serviceCard.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Customer should see their order data
      const orderDataSection = page.locator('[data-testid="order-data-section"]');
      await expect(orderDataSection).toBeVisible();

      // Verify order data is displayed
      await expect(orderDataSection.locator('text=/(School|Company|Reference) Name/')).toBeVisible();
    });

    test('customer cannot access another customer\'s service order data', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@company.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/portal/dashboard');

      // Try to access another customer's service directly
      await page.goto('/portal/services/other-customer-service-id');

      // Should show error or redirect
      await expect(page).toHaveURL('/portal/dashboard');
      const errorMessage = page.getByText('Service not found');
      await expect(errorMessage).toBeVisible();
    });
  });

  test.describe('Order Data Display Features', () => {
    test('displays order data with special characters correctly', async ({ page }) => {
      // Edge Case 7: Special characters in field values
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find service with special character data
      const serviceRow = page.locator('tr').filter({ hasText: 'Reference Check' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Verify special characters are displayed correctly
      await expect(page.getByText('O\'Reilly & Associates')).toBeVisible();
      await expect(page.getByText('Contains "quotes" and special chars')).toBeVisible();
    });

    test('handles very long field values with proper display', async ({ page }) => {
      // Edge Case 6: Very long field values
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find service with long description
      const serviceRow = page.locator('tr').filter({ hasText: 'Detailed Background' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Check that long text is displayed (possibly truncated with expand option)
      const longTextField = page.locator('[data-testid="long-text-field"]');
      await expect(longTextField).toBeVisible();

      // If truncated, should have expand button
      const expandButton = page.getByRole('button', { name: /show more|expand/i });
      if (await expandButton.isVisible()) {
        await expandButton.click();
        // Full text should now be visible
        await expect(longTextField).toContainText(/[\s\S]{1000,}/); // Contains at least 1000 chars
      }
    });

    test('displays fallback field names when workflow is deleted', async ({ page }) => {
      // Edge Case 2: Workflow has been deleted
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find service with deleted workflow
      const serviceRow = page.locator('tr').filter({ hasText: 'Legacy Service' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Business Rule 10: Should use fieldName with underscores converted to spaces
      await expect(page.getByText('school name')).toBeVisible(); // Instead of "School Name"
      await expect(page.getByText('degree type')).toBeVisible(); // Instead of "Degree Type"
    });

    test('preserves date and number formats as strings', async ({ page }) => {
      // Business Rule 9: Field values returned exactly as stored
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      const serviceRow = page.locator('tr').first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Dates should display as stored strings, not reformatted
      await expect(page.getByText('2020-05-15')).toBeVisible(); // Not "May 15, 2020"

      // Numbers should display as stored strings
      await expect(page.getByText('75000.00')).toBeVisible(); // Not "$75,000.00"
    });
  });

  test.describe('Performance', () => {
    test('service details with order data loads within 500ms', async ({ page }) => {
      // Definition of Done #6: Response time remains under 500ms
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Measure API response time
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/fulfillment/services/') && response.status() === 200
      );

      const startTime = Date.now();

      const serviceRow = page.locator('tr').first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      const response = await responsePromise;
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Check that response time is under 500ms
      expect(responseTime).toBeLessThan(500);

      // Verify the response includes orderData
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('orderData');
    });
  });

  test.describe('Error Handling', () => {
    test('handles database error gracefully when fetching order data', async ({ page }) => {
      // Edge Case 4: Database query fails - should still show service details
      // This would need to be simulated with a test flag or mock
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Simulate database error by accessing a service with test flag
      await page.goto('/fulfillment/services/test-db-error-service');

      // Service details should still load
      await expect(page.locator('[data-testid="service-details"]')).toBeVisible();

      // But order data section should show error or empty state
      const orderDataSection = page.locator('[data-testid="order-data-section"]');
      await expect(orderDataSection.getByText(/No order data available|Unable to load order data/)).toBeVisible();
    });

    test('handles missing orderItemId gracefully', async ({ page }) => {
      // Edge Case 3: OrderItem not found for service
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find a service without orderItemId (edge case service)
      const serviceRow = page.locator('tr').filter({ hasText: 'Standalone Service' }).first();
      await serviceRow.locator('button[aria-label="View details"]').click();

      await page.waitForSelector('[data-testid="service-details"]');

      // Should show service details
      await expect(page.locator('[data-testid="service-name"]')).toBeVisible();

      // Order data section should show empty state
      const orderDataSection = page.locator('[data-testid="order-data-section"]');
      await expect(orderDataSection.getByText('No order data available')).toBeVisible();
    });
  });
});