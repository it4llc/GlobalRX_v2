// /GlobalRX_v2/e2e/tests/draft-order-editing-bugs.spec.ts

// E2E REGRESSION TESTS for draft order editing bugs
// Tests the complete user flow to prove the bugs exist and verify the fixes work

import { test, expect } from '@playwright/test';

// Helper to login as a customer user
async function loginAsCustomer(page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'customer@test.com');
  await page.fill('input[name="password"]', 'Test123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('/portal/dashboard');
}

test.describe('Draft Order Editing Bugs - E2E Tests', () => {
  test.describe('REGRESSION TEST: Services not loading when editing draft', () => {
    test('should load services when editing a draft order', async ({ page }) => {
      // REGRESSION TEST: proves bug fix for services not loading when editing draft order

      // Login as customer
      await loginAsCustomer(page);

      // Navigate to orders
      await page.click('a[href="/portal/orders"]');
      await page.waitForURL('/portal/orders');

      // Find a draft order or create one
      const draftOrderExists = await page.locator('text=Draft').first().isVisible().catch(() => false);

      if (!draftOrderExists) {
        // Create a new draft order first
        await page.click('button:has-text("New Order")');
        await page.waitForURL('/portal/orders/new');

        // Fill in minimal required info
        await page.fill('input[name="subject.firstName"]', 'Test');
        await page.fill('input[name="subject.lastName"]', 'Draft');

        // Save as draft
        await page.click('button:has-text("Save as Draft")');
        await page.waitForSelector('text=Order saved as draft');

        // Go back to orders list
        await page.goto('/portal/orders');
      }

      // Click edit on the draft order
      const editButton = page.locator('tr:has-text("Draft")').first().locator('button:has-text("Edit")');
      await editButton.click();

      // Wait for order form to load
      await page.waitForSelector('text=Edit Order');

      // Navigate to Services & Locations tab (step 1)
      await page.click('button:has-text("Services & Locations")');

      // CRITICAL ASSERTION: Services should be loaded and visible
      // This would fail before the bug fix
      await expect(page.locator('text=Select Services')).toBeVisible({ timeout: 10000 });

      // Verify services are actually available
      const servicesSection = page.locator('[data-testid="services-selection"]');
      await expect(servicesSection).toBeVisible();

      // Should see at least one service option
      const serviceCheckboxes = page.locator('input[type="checkbox"][name^="service"]');
      const serviceCount = await serviceCheckboxes.count();
      expect(serviceCount).toBeGreaterThan(0);
    });

    test('should allow adding services to a draft order during edit', async ({ page }) => {
      // Login
      await loginAsCustomer(page);

      // Navigate to orders and edit a draft
      await page.goto('/portal/orders');

      // Create or find draft order
      let draftOrderRow = page.locator('tr:has-text("Draft")').first();
      const hasDraft = await draftOrderRow.isVisible().catch(() => false);

      if (!hasDraft) {
        // Create draft order
        await page.click('button:has-text("New Order")');
        await page.fill('input[name="subject.firstName"]', 'Service');
        await page.fill('input[name="subject.lastName"]', 'Test');
        await page.click('button:has-text("Save as Draft")');
        await page.goto('/portal/orders');
        draftOrderRow = page.locator('tr:has-text("Draft")').first();
      }

      // Edit the draft order
      await draftOrderRow.locator('button:has-text("Edit")').click();

      // Go to Services tab
      await page.click('button:has-text("Services & Locations")');

      // Wait for services to load
      await page.waitForSelector('[data-testid="services-selection"]');

      // Select a service if not already selected
      const firstService = page.locator('input[type="checkbox"][name^="service"]').first();
      const isChecked = await firstService.isChecked();

      if (!isChecked) {
        await firstService.check();
      }

      // Save the order
      await page.click('button:has-text("Save as Draft")');

      // Verify success
      await expect(page.locator('text=Order saved')).toBeVisible();
    });
  });

  test.describe('REGRESSION TEST: Error when updating draft order', () => {
    test('should update draft order without server errors', async ({ page }) => {
      // REGRESSION TEST: proves bug fix for missing logger import

      // Login
      await loginAsCustomer(page);

      // Go to orders
      await page.goto('/portal/orders');

      // Create a new draft order
      await page.click('button:has-text("New Order")');

      // Fill initial data
      await page.fill('input[name="subject.firstName"]', 'Initial');
      await page.fill('input[name="subject.lastName"]', 'Name');

      // Save as draft
      await page.click('button:has-text("Save as Draft")');
      await expect(page.locator('text=Order saved as draft')).toBeVisible();

      // Navigate back to orders list
      await page.goto('/portal/orders');

      // Find and edit the draft we just created
      const draftRow = page.locator('tr:has-text("Initial Name")').first();
      await draftRow.locator('button:has-text("Edit")').click();

      // Update the subject information
      await page.fill('input[name="subject.firstName"]', 'Updated');
      await page.fill('input[name="subject.lastName"]', 'Person');
      await page.fill('input[name="subject.middleName"]', 'Middle');

      // Save as draft again - This would cause error before fix
      await page.click('button:has-text("Save as Draft")');

      // CRITICAL ASSERTION: Should save without errors
      // Before fix, would see "Failed to update order" due to logger undefined
      await expect(page.locator('text=Order saved')).toBeVisible();
      await expect(page.locator('text=Failed to update order')).not.toBeVisible();

      // Edit again to verify multiple saves work
      await page.fill('input[name="subject.email"]', 'updated@example.com');
      await page.click('button:has-text("Save as Draft")');

      // Should still work
      await expect(page.locator('text=Order saved')).toBeVisible();
    });

    test('should handle draft to submitted status change', async ({ page }) => {
      // Login
      await loginAsCustomer(page);

      // Create a complete draft order
      await page.goto('/portal/orders/new');

      // Fill all required fields for submission
      // Subject Information
      await page.fill('input[name="subject.firstName"]', 'Complete');
      await page.fill('input[name="subject.lastName"]', 'Order');
      await page.fill('input[name="subject.dateOfBirth"]', '1990-01-15');
      await page.fill('input[name="subject.email"]', 'complete@example.com');
      await page.fill('input[name="subject.phone"]', '555-0123');

      // Navigate to Services tab
      await page.click('button:has-text("Next")');

      // Select at least one service
      const serviceCheckbox = page.locator('input[type="checkbox"][name^="service"]').first();
      await serviceCheckbox.check();

      // Navigate to Review tab
      await page.click('button:has-text("Next")');

      // First save as draft
      await page.click('button:has-text("Save as Draft")');
      await expect(page.locator('text=Order saved as draft')).toBeVisible();

      // Now go back and edit to submit
      await page.goto('/portal/orders');
      const orderRow = page.locator('tr:has-text("Complete Order")').first();
      await orderRow.locator('button:has-text("Edit")').click();

      // Navigate to review tab
      await page.click('button:has-text("Review & Submit")');

      // Submit the order
      await page.click('button:has-text("Submit Order")');

      // Should change from draft to submitted
      await expect(page.locator('text=Order submitted successfully')).toBeVisible();

      // Verify status changed
      await page.goto('/portal/orders');
      const submittedRow = page.locator('tr:has-text("Complete Order")').first();
      await expect(submittedRow.locator('text=Submitted')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle network errors gracefully when loading services', async ({ page }) => {
      // Login
      await loginAsCustomer(page);

      // Simulate network issue
      await page.route('**/api/portal/orders/services*', route => {
        route.abort('failed');
      });

      // Try to create new order
      await page.goto('/portal/orders/new');

      // Should show error message about services
      await expect(page.locator('text=/Failed to load services|Unable to load services/')).toBeVisible({ timeout: 10000 });
    });

    test('should recover from session refresh while editing', async ({ page }) => {
      // Login
      await loginAsCustomer(page);

      // Start creating an order
      await page.goto('/portal/orders/new');
      await page.fill('input[name="subject.firstName"]', 'Refresh');
      await page.fill('input[name="subject.lastName"]', 'Test');

      // Save as draft
      await page.click('button:has-text("Save as Draft")');
      await expect(page.locator('text=Order saved')).toBeVisible();

      // Get the current URL (should have edit parameter)
      const editUrl = page.url();
      expect(editUrl).toContain('edit=');

      // Simulate page refresh
      await page.reload();

      // Should restore the form with data
      await expect(page.locator('input[name="subject.firstName"]')).toHaveValue('Refresh');
      await expect(page.locator('input[name="subject.lastName"]')).toHaveValue('Test');

      // Services should still be available after refresh
      await page.click('button:has-text("Services & Locations")');
      await expect(page.locator('[data-testid="services-selection"]')).toBeVisible();
    });

    test('should prevent editing orders from other customers', async ({ page }) => {
      // This test assumes proper backend validation
      // Try to access an order from another customer via direct URL
      await loginAsCustomer(page);

      // Try to access an order that doesn't belong to this customer
      // Using a UUID that likely doesn't exist or belongs to another customer
      await page.goto('/portal/orders/edit?edit=550e8400-e29b-41d4-a716-446655440000');

      // Should either redirect or show error
      const hasError = await page.locator('text=/not found|forbidden|permission/i').isVisible().catch(() => false);
      const wasRedirected = page.url().includes('/portal/orders') && !page.url().includes('edit=');

      expect(hasError || wasRedirected).toBeTruthy();
    });

    test('should validate required fields before submission', async ({ page }) => {
      // Login
      await loginAsCustomer(page);

      // Create incomplete draft
      await page.goto('/portal/orders/new');

      // Only fill first name (missing last name)
      await page.fill('input[name="subject.firstName"]', 'Incomplete');

      // Try to navigate forward
      await page.click('button:has-text("Next")');

      // Should show validation error
      await expect(page.locator('text=/Last name is required|Please enter last name/')).toBeVisible();

      // Fill last name
      await page.fill('input[name="subject.lastName"]', 'Order');

      // Now should be able to proceed
      await page.click('button:has-text("Next")');
      await expect(page.locator('text=Services & Locations')).toBeVisible();
    });
  });
});