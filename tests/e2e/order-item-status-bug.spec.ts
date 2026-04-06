// /GlobalRX_v2/tests/e2e/order-item-status-bug.spec.ts

import { test, expect } from '@playwright/test';

test.describe('REGRESSION TEST: Order Item Status Bug - E2E Tests', () => {

  test.describe('Draft Order Submission Bug', () => {
    test('REGRESSION TEST: OrderItems should update to submitted status when draft order is submitted', async ({ page }) => {
      // This test demonstrates the bug where OrderItems remain in "draft" status
      // when a draft order is submitted, instead of updating to "submitted"

      // Step 1: Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@testcompany.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to portal dashboard
      await page.waitForURL(/\/portal/);
      await page.goto('/portal/dashboard');

      // Step 3: Create a new draft order
      await page.click('[data-testid="new-order-button"], button:has-text("New Order"), a[href*="/orders/new"]');
      await page.waitForURL(/\/portal\/orders\/new/);

      // Step 4: Fill in subject information
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.fill('input[name="email"]', 'john.doe@example.com');
      await page.fill('input[name="dateOfBirth"]', '1990-01-15');

      // Step 5: Add at least one service to the order
      await page.click('[data-testid="add-service-button"], button:has-text("Add Service")');
      await page.selectOption('select[name="serviceId"], [data-testid="service-select"]', 'criminal-background-check');
      await page.selectOption('select[name="locationId"], [data-testid="location-select"]', 'usa');
      await page.click('button:has-text("Add to Order")');

      // Step 6: Save as draft
      await page.click('button:has-text("Save Draft")');

      // Wait for draft to be saved
      await expect(page.locator('.toast, [role="status"]')).toContainText('Order saved as draft');

      // Get the order ID from the URL for later verification
      const currentUrl = page.url();
      const orderIdMatch = currentUrl.match(/\/orders\/([^\/]+)/);
      expect(orderIdMatch).toBeTruthy();
      const orderId = orderIdMatch![1];

      // Step 7: Verify order is in draft status
      await expect(page.locator('[data-testid="order-status"], .order-status')).toContainText('Draft');

      // Step 8: Verify order items are in draft status
      // This is the key assertion that will FAIL before the bug fix
      const serviceItems = page.locator('[data-testid="service-item"], .service-item');
      await expect(serviceItems).toHaveCount(1);

      const firstItem = serviceItems.first();
      await expect(firstItem).toContainText('Criminal Background Check');
      await expect(firstItem.locator('[data-testid="item-status"], .item-status')).toContainText('Draft');

      // Step 9: Submit the draft order
      await page.click('button:has-text("Submit Order")');

      // Confirm submission if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Yes"), button:has-text("Confirm")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Wait for submission to complete
      await expect(page.locator('.toast, [role="status"]')).toContainText('Order submitted successfully');

      // Step 10: Verify order status changed to submitted
      await expect(page.locator('[data-testid="order-status"], .order-status')).toContainText('Submitted');

      // Step 11: THE CRITICAL ASSERTION - Verify order items also changed to submitted
      // This assertion will FAIL before the bug fix because OrderItems remain in "draft"
      // After the fix, OrderItems should show "Submitted" status
      await expect(firstItem.locator('[data-testid="item-status"], .item-status')).toContainText('Submitted');

      // Additional verification: Check that all services in the order are now "submitted"
      const allServiceItems = page.locator('[data-testid="service-item"], .service-item');
      const itemCount = await allServiceItems.count();

      for (let i = 0; i < itemCount; i++) {
        const item = allServiceItems.nth(i);
        await expect(item.locator('[data-testid="item-status"], .item-status')).toContainText('Submitted');
      }
    });

    test('REGRESSION TEST: Multiple service items all update to submitted when draft order is submitted', async ({ page }) => {
      // This test ensures the fix works for orders with multiple services

      // Step 1: Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@testcompany.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Create new order
      await page.goto('/portal/orders/new');

      // Step 3: Fill subject info
      await page.fill('input[name="firstName"]', 'Jane');
      await page.fill('input[name="lastName"]', 'Smith');
      await page.fill('input[name="email"]', 'jane.smith@example.com');
      await page.fill('input[name="dateOfBirth"]', '1985-05-20');

      // Step 4: Add multiple services
      // Add first service
      await page.click('[data-testid="add-service-button"], button:has-text("Add Service")');
      await page.selectOption('select[name="serviceId"]', 'criminal-background-check');
      await page.selectOption('select[name="locationId"]', 'usa');
      await page.click('button:has-text("Add to Order")');

      // Add second service
      await page.click('[data-testid="add-service-button"], button:has-text("Add Service")');
      await page.selectOption('select[name="serviceId"]', 'employment-verification');
      await page.selectOption('select[name="locationId"]', 'usa');
      await page.click('button:has-text("Add to Order")');

      // Add third service
      await page.click('[data-testid="add-service-button"], button:has-text("Add Service")');
      await page.selectOption('select[name="serviceId"]', 'education-verification');
      await page.selectOption('select[name="locationId"]', 'usa');
      await page.click('button:has-text("Add to Order")');

      // Step 5: Save as draft
      await page.click('button:has-text("Save Draft")');
      await expect(page.locator('.toast')).toContainText('Order saved as draft');

      // Step 6: Verify all items are in draft status
      const serviceItems = page.locator('[data-testid="service-item"], .service-item');
      await expect(serviceItems).toHaveCount(3);

      // Check each item is initially draft
      for (let i = 0; i < 3; i++) {
        const item = serviceItems.nth(i);
        await expect(item.locator('[data-testid="item-status"], .item-status')).toContainText('Draft');
      }

      // Step 7: Submit the order
      await page.click('button:has-text("Submit Order")');

      const confirmButton = page.locator('button:has-text("Yes"), button:has-text("Confirm")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await expect(page.locator('.toast')).toContainText('Order submitted successfully');

      // Step 8: THE CRITICAL ASSERTION - All items should now be "Submitted"
      // This will FAIL before the bug fix because all items remain "Draft"
      for (let i = 0; i < 3; i++) {
        const item = serviceItems.nth(i);
        await expect(item.locator('[data-testid="item-status"], .item-status')).toContainText('Submitted');
      }
    });

    test('REGRESSION TEST: OrderItems status correct when creating and submitting new order in one flow', async ({ page }) => {
      // This test ensures the fix doesn't break the case where orders are created and submitted
      // in a single action (which should work correctly already)

      // Step 1: Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@testcompany.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Create new order
      await page.goto('/portal/orders/new');

      // Step 3: Fill subject info
      await page.fill('input[name="firstName"]', 'Bob');
      await page.fill('input[name="lastName"]', 'Johnson');
      await page.fill('input[name="email"]', 'bob.johnson@example.com');
      await page.fill('input[name="dateOfBirth"]', '1992-12-10');

      // Step 4: Add service
      await page.click('[data-testid="add-service-button"], button:has-text("Add Service")');
      await page.selectOption('select[name="serviceId"]', 'drug-screening');
      await page.selectOption('select[name="locationId"]', 'usa');
      await page.click('button:has-text("Add to Order")');

      // Step 5: Submit directly (create and submit in one action)
      await page.click('button:has-text("Create and Submit Order"), button:has-text("Submit Order")');

      const confirmButton = page.locator('button:has-text("Yes"), button:has-text("Confirm")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      await expect(page.locator('.toast')).toContainText('Order submitted successfully');

      // Step 6: Verify both order and items are submitted
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Submitted');

      const serviceItems = page.locator('[data-testid="service-item"], .service-item');
      await expect(serviceItems).toHaveCount(1);
      await expect(serviceItems.first().locator('[data-testid="item-status"]')).toContainText('Submitted');
    });
  });

  test.describe('Order Status Consistency Verification', () => {
    test('REGRESSION TEST: Internal user can see OrderItem status matches Order status after submission', async ({ page }) => {
      // This test verifies the bug fix from an internal user's perspective

      // Step 1: Login as internal user with fulfillment permissions
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to a draft order that has items
      await page.goto('/fulfillment/orders');

      // Find and click on a draft order
      const draftOrderLink = page.locator('a:has-text("Draft"), tr:has(td:has-text("Draft"))').first();
      await draftOrderLink.click();

      // Step 3: Verify current status
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Draft');

      const serviceItems = page.locator('[data-testid="service-item"], .service-item');
      const itemCount = await serviceItems.count();

      if (itemCount > 0) {
        // Verify all items are currently draft
        for (let i = 0; i < itemCount; i++) {
          const item = serviceItems.nth(i);
          await expect(item.locator('[data-testid="item-status"]')).toContainText('Draft');
        }

        // Step 4: Use internal user's ability to change order status to submitted
        const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
        await statusDropdown.selectOption('submitted');

        await expect(page.locator('.toast')).toContainText('Order status updated successfully');

        // Step 5: Verify both order and all items are now submitted
        await expect(page.locator('[data-testid="order-status"]')).toContainText('Submitted');

        // THE CRITICAL ASSERTION - All OrderItems should also be submitted
        for (let i = 0; i < itemCount; i++) {
          const item = serviceItems.nth(i);
          await expect(item.locator('[data-testid="item-status"]')).toContainText('Submitted');
        }
      }
    });

    test('REGRESSION TEST: Status transitions other than draft-to-submitted do not affect OrderItems', async ({ page }) => {
      // This test ensures the fix is specific to draft->submitted and doesn't break other transitions

      // Step 1: Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Find an order in "submitted" status
      await page.goto('/fulfillment/orders');
      const submittedOrderLink = page.locator('a:has-text("Submitted"), tr:has(td:has-text("Submitted"))').first();
      await submittedOrderLink.click();

      // Step 3: Verify current status
      await expect(page.locator('[data-testid="order-status"]')).toContainText('Submitted');

      const serviceItems = page.locator('[data-testid="service-item"], .service-item');
      const itemCount = await serviceItems.count();

      if (itemCount > 0) {
        // Remember the current item statuses
        const initialItemStatuses = [];
        for (let i = 0; i < itemCount; i++) {
          const item = serviceItems.nth(i);
          const statusText = await item.locator('[data-testid="item-status"]').textContent();
          initialItemStatuses.push(statusText?.trim());
        }

        // Step 4: Change order status to processing
        const statusDropdown = page.locator('select[name="orderStatus"], [data-testid="order-status-dropdown"]');
        await statusDropdown.selectOption('processing');

        await expect(page.locator('.toast')).toContainText('Order status updated successfully');

        // Step 5: Verify order is now processing but items are unchanged
        await expect(page.locator('[data-testid="order-status"]')).toContainText('Processing');

        // Item statuses should remain the same (not automatically updated)
        for (let i = 0; i < itemCount; i++) {
          const item = serviceItems.nth(i);
          const currentStatusText = await item.locator('[data-testid="item-status"]').textContent();
          expect(currentStatusText?.trim()).toBe(initialItemStatuses[i]);
        }
      }
    });
  });
});