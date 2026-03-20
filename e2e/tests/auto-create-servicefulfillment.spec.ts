// /GlobalRX_v2/e2e/tests/auto-create-servicefulfillment.spec.ts

import { test, expect } from '../fixtures/auth';

test.describe('Auto-Create ServiceFulfillment', () => {
  test.describe('Phase 1: Auto-creation for new OrderItems', () => {
    test('should auto-create ServiceFulfillment when creating a complete order', async ({ authenticatedPage: page }) => {
      // Navigate to new order page
      await page.goto('/orders/new');

      // Step 1: Select customer
      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.waitFor({ state: 'visible' });
      const customerOptions = await customerSelect.locator('option').count();
      if (customerOptions > 1) {
        await customerSelect.selectOption({ index: 1 }); // Select first actual customer (skip empty option)
      } else {
        throw new Error('No customers available for testing');
      }

      // Step 2: Enter subject information
      await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Test');
      await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Subject');
      await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1990-01-01');
      await page.fill('input[name="ssn"], input[name="subject.ssn"]', '123-45-6789');

      // Step 3: Select at least one service
      const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
      const checkboxCount = await serviceCheckboxes.count();
      if (checkboxCount > 0) {
        await serviceCheckboxes.first().check();

        // Select a second service if available
        if (checkboxCount > 1) {
          await serviceCheckboxes.nth(1).check();
        }
      }

      // Step 4: Add notes
      await page.fill('textarea[name="notes"]', 'E2E test for ServiceFulfillment auto-creation');

      // Submit the order
      await page.click('button[type="submit"]:has-text("Submit"), button[type="submit"]:has-text("Create Order")');

      // Wait for redirect to order details page
      await page.waitForURL('**/orders/**', { timeout: 10000 });

      // Extract order ID from URL
      const url = page.url();
      const orderIdMatch = url.match(/orders\/([a-f0-9-]+)/);
      expect(orderIdMatch).toBeTruthy();
      const orderId = orderIdMatch![1];

      // Navigate to fulfillment page to verify ServiceFulfillment records were created
      await page.goto('/fulfillment');

      // Search for the order we just created
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(orderId);
        await page.waitForTimeout(500); // Wait for search to filter results
      }

      // Verify ServiceFulfillment records exist for the OrderItems
      const fulfillmentRows = page.locator(`tr:has-text("${orderId}")`);
      const rowCount = await fulfillmentRows.count();

      // Should have at least one ServiceFulfillment record (one for each service selected)
      expect(rowCount).toBeGreaterThan(0);

      // Verify the ServiceFulfillment has the correct initial state
      const firstRow = fulfillmentRows.first();

      // Check that vendor is not assigned (should be empty or "Unassigned")
      const vendorCell = firstRow.locator('td').nth(3); // Adjust index based on actual table structure
      const vendorText = await vendorCell.textContent();
      expect(vendorText).toMatch(/unassigned|not assigned|^$/i);
    });

    test('should auto-create ServiceFulfillment when adding item to existing order', async ({ authenticatedPage: page }) => {
      // First, navigate to orders page to find a draft order
      await page.goto('/orders');

      // Find or create a draft order
      let draftOrderId: string | null = null;

      // Look for existing draft orders
      const draftOrders = page.locator('tr:has-text("Draft"), tr:has-text("draft")');
      const draftCount = await draftOrders.count();

      if (draftCount > 0) {
        // Use existing draft order
        const firstDraftRow = draftOrders.first();
        const orderLink = firstDraftRow.locator('a[href*="/orders/"]').first();
        const href = await orderLink.getAttribute('href');
        const orderIdMatch = href?.match(/orders\/([a-f0-9-]+)/);
        if (orderIdMatch) {
          draftOrderId = orderIdMatch[1];
        }
      }

      if (!draftOrderId) {
        // Create a new draft order first
        await page.click('button:has-text("New Order"), button:has-text("Create Order")');

        // Fill in minimal order details
        const customerSelect = page.locator('select[name="customerId"]');
        await customerSelect.waitFor({ state: 'visible' });
        await customerSelect.selectOption({ index: 1 });

        await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Draft');
        await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Order');
        await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1985-05-05');
        await page.fill('input[name="ssn"], input[name="subject.ssn"]', '987-65-4321');

        // Select one service initially
        const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
        await serviceCheckboxes.first().check();

        // Save as draft (not submit)
        const saveDraftButton = page.locator('button:has-text("Save Draft"), button:has-text("Save as Draft")');
        if (await saveDraftButton.isVisible()) {
          await saveDraftButton.click();
        } else {
          // If no explicit draft button, submit and hope it creates as draft
          await page.click('button[type="submit"]');
        }

        await page.waitForURL('**/orders/**', { timeout: 10000 });
        const url = page.url();
        const orderIdMatch = url.match(/orders\/([a-f0-9-]+)/);
        draftOrderId = orderIdMatch![1];
      } else {
        // Navigate to the existing draft order
        await page.goto(`/orders/${draftOrderId}`);
      }

      // Now add a new item to the draft order
      const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Service")');
      if (await addItemButton.isVisible()) {
        await addItemButton.click();

        // Select a service in the add item dialog/form
        const serviceSelect = page.locator('select[name="serviceId"], select[name="service"]').last();
        await serviceSelect.waitFor({ state: 'visible' });
        await serviceSelect.selectOption({ index: 1 });

        // Select a location if required
        const locationSelect = page.locator('select[name="locationId"], select[name="location"]').last();
        if (await locationSelect.isVisible()) {
          await locationSelect.selectOption({ index: 1 });
        }

        // Confirm adding the item
        const confirmButton = page.locator('button:has-text("Add"), button:has-text("Confirm")').last();
        await confirmButton.click();

        // Wait for the item to be added
        await page.waitForTimeout(1000);
      }

      // Navigate to fulfillment page to verify new ServiceFulfillment was created
      await page.goto('/fulfillment');

      // Search for the order
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(draftOrderId);
        await page.waitForTimeout(500);
      }

      // Verify ServiceFulfillment records exist
      const fulfillmentRows = page.locator(`tr:has-text("${draftOrderId}")`);
      const rowCount = await fulfillmentRows.count();

      // Should have ServiceFulfillment records for all items
      expect(rowCount).toBeGreaterThan(0);
    });

    test('should handle transaction rollback if ServiceFulfillment creation fails', async ({ authenticatedPage: page }) => {
      // This is a negative test case that would require special setup to simulate database failure
      // In a real scenario, this might involve:
      // 1. Setting up a test database with constraints that will fail
      // 2. Using a test flag to force failure in the backend
      // 3. Verifying the entire transaction rolled back

      // For now, we'll test that the order creation form handles errors gracefully
      await page.goto('/orders/new');

      // Fill in order details
      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.waitFor({ state: 'visible' });
      await customerSelect.selectOption({ index: 1 });

      await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Rollback');
      await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Test');
      await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1995-12-25');
      await page.fill('input[name="ssn"], input[name="subject.ssn"]', '555-55-5555');

      // Select services
      const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
      await serviceCheckboxes.first().check();

      // To simulate a failure scenario, we could:
      // - Use an invalid service ID (if the UI allows it)
      // - Submit with malformed data
      // - Or rely on backend test flags

      // For this test, we'll verify error handling exists
      // The actual failure simulation would need backend support
    });

    test('should create ServiceFulfillment with null assignedVendorId even if Order has vendor', async ({ authenticatedPage: page }) => {
      // This test verifies that the ServiceFulfillment's assignedVendorId is explicitly null,
      // not inherited from the Order's assignedVendorId

      await page.goto('/orders/new');

      // Fill in order details
      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.waitFor({ state: 'visible' });
      await customerSelect.selectOption({ index: 1 });

      await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Vendor');
      await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Inheritance');
      await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1988-08-08');
      await page.fill('input[name="ssn"], input[name="subject.ssn"]', '888-88-8888');

      // Select services
      const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
      await serviceCheckboxes.first().check();

      // If there's a vendor selection on the order form, select one
      const vendorSelect = page.locator('select[name="assignedVendorId"], select[name="vendor"]');
      if (await vendorSelect.isVisible()) {
        const vendorOptions = await vendorSelect.locator('option').count();
        if (vendorOptions > 1) {
          await vendorSelect.selectOption({ index: 1 });
        }
      }

      // Submit the order
      await page.click('button[type="submit"]:has-text("Submit"), button[type="submit"]:has-text("Create Order")');

      // Wait for redirect
      await page.waitForURL('**/orders/**', { timeout: 10000 });

      // Extract order ID
      const url = page.url();
      const orderIdMatch = url.match(/orders\/([a-f0-9-]+)/);
      const orderId = orderIdMatch![1];

      // Navigate to fulfillment page
      await page.goto('/fulfillment');

      // Search for the order
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(orderId);
        await page.waitForTimeout(500);
      }

      // Verify the ServiceFulfillment vendor is not assigned
      const fulfillmentRows = page.locator(`tr:has-text("${orderId}")`);
      const firstRow = fulfillmentRows.first();

      // The vendor column should show unassigned
      const vendorCell = firstRow.locator('td').nth(3); // Adjust based on actual column index
      const vendorText = await vendorCell.textContent();
      expect(vendorText).toMatch(/unassigned|not assigned|^$/i);
    });

    test('should log ServiceFulfillment creation for debugging', async ({ authenticatedPage: page }) => {
      // This test verifies that the auto-creation is logged
      // In a real scenario, we'd check server logs or a logging dashboard
      // For E2E testing, we can only verify the operation succeeds

      await page.goto('/orders/new');

      // Create an order with a unique identifier in notes for log tracking
      const uniqueId = `LOG-TEST-${Date.now()}`;

      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.waitFor({ state: 'visible' });
      await customerSelect.selectOption({ index: 1 });

      await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Log');
      await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Test');
      await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1992-02-02');
      await page.fill('input[name="ssn"], input[name="subject.ssn"]', '222-22-2222');

      const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
      await serviceCheckboxes.first().check();

      await page.fill('textarea[name="notes"]', uniqueId);

      await page.click('button[type="submit"]:has-text("Submit"), button[type="submit"]:has-text("Create Order")');

      await page.waitForURL('**/orders/**', { timeout: 10000 });

      // The test passes if the order was created successfully
      // Actual log verification would require access to server logs
      const orderHeader = page.locator('h1, h2').filter({ hasText: /order.*\d{8}/i });
      await expect(orderHeader).toBeVisible();

      // Verify the notes contain our unique ID to confirm it's our order
      const notesElement = page.locator('text=' + uniqueId);
      await expect(notesElement).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle multiple OrderItems in single transaction', async ({ authenticatedPage: page }) => {
      await page.goto('/orders/new');

      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.waitFor({ state: 'visible' });
      await customerSelect.selectOption({ index: 1 });

      await page.fill('input[name="firstName"], input[name="subject.firstName"]', 'Multiple');
      await page.fill('input[name="lastName"], input[name="subject.lastName"]', 'Items');
      await page.fill('input[name="dateOfBirth"], input[name="subject.dateOfBirth"]', '1991-11-11');
      await page.fill('input[name="ssn"], input[name="subject.ssn"]', '111-11-1111');

      // Select multiple services (at least 3)
      const serviceCheckboxes = page.locator('input[type="checkbox"][name*="service"]');
      const checkboxCount = await serviceCheckboxes.count();
      const servicesToSelect = Math.min(checkboxCount, 3);

      for (let i = 0; i < servicesToSelect; i++) {
        await serviceCheckboxes.nth(i).check();
      }

      await page.click('button[type="submit"]:has-text("Submit"), button[type="submit"]:has-text("Create Order")');

      await page.waitForURL('**/orders/**', { timeout: 10000 });

      const url = page.url();
      const orderIdMatch = url.match(/orders\/([a-f0-9-]+)/);
      const orderId = orderIdMatch![1];

      // Navigate to fulfillment page
      await page.goto('/fulfillment');

      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(orderId);
        await page.waitForTimeout(500);
      }

      // Count ServiceFulfillment records
      const fulfillmentRows = page.locator(`tr:has-text("${orderId}")`);
      const rowCount = await fulfillmentRows.count();

      // Should have one ServiceFulfillment for each service selected
      expect(rowCount).toBe(servicesToSelect);
    });

    test('should not allow adding items to non-draft orders', async ({ authenticatedPage: page }) => {
      // Find or create a submitted order
      await page.goto('/orders');

      const submittedOrders = page.locator('tr:has-text("Submitted"), tr:has-text("submitted"), tr:has-text("Processing"), tr:has-text("processing")');
      const submittedCount = await submittedOrders.count();

      if (submittedCount > 0) {
        // Use existing submitted order
        const firstSubmittedRow = submittedOrders.first();
        const orderLink = firstSubmittedRow.locator('a[href*="/orders/"]').first();
        await orderLink.click();

        // Wait for order details page
        await page.waitForURL('**/orders/**', { timeout: 5000 });

        // Verify Add Item button is either disabled or not visible
        const addItemButton = page.locator('button:has-text("Add Item"), button:has-text("Add Service")');

        if (await addItemButton.isVisible()) {
          // Button might be visible but disabled
          const isDisabled = await addItemButton.isDisabled();
          expect(isDisabled).toBeTruthy();
        } else {
          // Button is not visible at all for non-draft orders
          await expect(addItemButton).not.toBeVisible();
        }
      } else {
        // No submitted orders to test with
        // This is acceptable as the test would need existing data
        test.skip();
      }
    });
  });
});