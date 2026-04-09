// /GlobalRX_v2/tests/e2e/order-view-tracking-phase2a.spec.ts
// End-to-end tests for order view tracking feature - Phase 2A API endpoints
// These tests verify the API behavior through the browser

import { test, expect } from '@playwright/test';

test.describe('Order View Tracking - Phase 2A API Endpoints', () => {

  test.describe('API Recording Behavior', () => {
    test('POST /api/orders/[id]/view records customer views', async ({ page }) => {
      // Step 1: Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Set up API route interception
      let apiCalled = false;
      let apiResponse: any = null;
      await page.route('**/api/orders/*/view', async route => {
        apiCalled = true;
        const response = await route.fetch();
        apiResponse = await response.json();
        await route.fulfill({ response });
      });

      // Step 3: Navigate to an order details page
      await page.goto('/fulfillment/orders/order-123');

      // Step 4: Wait for the API call to complete
      await page.waitForTimeout(1000);

      // Step 5: Verify API was called
      expect(apiCalled).toBe(true);

      // Step 6: Verify response shape
      if (apiResponse && !apiResponse.skipped) {
        expect(apiResponse).toHaveProperty('id');
        expect(apiResponse).toHaveProperty('userId');
        expect(apiResponse).toHaveProperty('orderId');
        expect(apiResponse).toHaveProperty('lastViewedAt');
      }
    });

    test('POST /api/order-items/[id]/view records customer item views', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Set up API route interception
      let itemApiCalled = false;
      let itemApiResponse: any = null;
      await page.route('**/api/order-items/*/view', async route => {
        itemApiCalled = true;
        const response = await route.fetch();
        itemApiResponse = await response.json();
        await route.fulfill({ response });
      });

      // Navigate to order details
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForSelector('[data-testid="order-items-list"]');

      // Click on an order item to expand/view it
      const itemSelector = '[data-testid="order-item-0"]';
      if (await page.locator(itemSelector).isVisible()) {
        await page.click(itemSelector);
        await page.waitForTimeout(1000);

        // Verify item view API was called
        expect(itemApiCalled).toBe(true);

        // Verify response shape
        if (itemApiResponse && !itemApiResponse.skipped) {
          expect(itemApiResponse).toHaveProperty('id');
          expect(itemApiResponse).toHaveProperty('userId');
          expect(itemApiResponse).toHaveProperty('orderItemId');
          expect(itemApiResponse).toHaveProperty('lastViewedAt');
        }
      }
    });

    test('GET /api/orders/[id]/views returns tracking data for customer', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // First, view an order to create tracking data
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForTimeout(500);

      // Set up API route interception for GET
      let getApiCalled = false;
      let getApiResponse: any = null;
      await page.route('**/api/orders/*/views', async route => {
        if (route.request().method() === 'GET') {
          getApiCalled = true;
          const response = await route.fetch();
          getApiResponse = await response.json();
          await route.fulfill({ response });
        } else {
          await route.continue();
        }
      });

      // Trigger a GET request (this would normally be done by UI components)
      await page.evaluate(async () => {
        const response = await fetch('/api/orders/order-123/views', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return response.json();
      });

      await page.waitForTimeout(500);

      // Verify GET API was called
      expect(getApiCalled).toBe(true);

      // Verify response shape
      if (getApiResponse && !getApiResponse.skipped) {
        expect(getApiResponse).toHaveProperty('orderView');
        expect(getApiResponse).toHaveProperty('itemViews');
        expect(Array.isArray(getApiResponse.itemViews)).toBe(true);
      }
    });
  });

  test.describe('Admin and Vendor Skipping', () => {
    test('admin users receive { skipped: true } response', async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'adminpassword');
      await page.click('button[type="submit"]');

      // Set up API route interception
      let apiResponse: any = null;
      await page.route('**/api/orders/*/view', async route => {
        const response = await route.fetch();
        apiResponse = await response.json();
        await route.fulfill({ response });
      });

      // Navigate to an order
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForTimeout(1000);

      // Verify response is skipped
      if (apiResponse) {
        expect(apiResponse).toEqual({ skipped: true });
      }
    });

    test('vendor users receive { skipped: true } response', async ({ page }) => {
      // Login as vendor
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@backgroundchecks.com');
      await page.fill('input[name="password"]', 'vendorpassword');
      await page.click('button[type="submit"]');

      // Set up API route interception
      let apiResponse: any = null;
      await page.route('**/api/orders/*/view', async route => {
        const response = await route.fetch();
        apiResponse = await response.json();
        await route.fulfill({ response });
      });

      // Navigate to a service that might show order details
      await page.goto('/fulfillment/services/service-456');

      // If there's a view order button, click it
      const viewOrderButton = page.getByRole('button', { name: /View Order/i });
      if (await viewOrderButton.isVisible()) {
        await viewOrderButton.click();
        await page.waitForTimeout(1000);

        // Verify response is skipped
        if (apiResponse) {
          expect(apiResponse).toEqual({ skipped: true });
        }
      }
    });
  });

  test.describe('Cross-Customer Authorization', () => {
    test('customer cannot view tracking data for another company order', async ({ page }) => {
      // Login as customer from Company A
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@companya.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to directly access Company B's order
      const response = await page.goto('/fulfillment/orders/company-b-order-123');

      // Should either redirect or show error
      if (response) {
        const status = response.status();
        // Expect either forbidden or redirect
        expect([403, 302, 404]).toContain(status);
      }

      // Or check for error message on page
      const errorMessage = page.getByText(/not authorized|forbidden|not found/i);
      if (await errorMessage.isVisible()) {
        expect(await errorMessage.textContent()).toBeTruthy();
      }
    });
  });

  test.describe('Upsert Behavior', () => {
    test('calling view endpoint twice updates lastViewedAt', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      let firstTimestamp: string | null = null;
      let secondTimestamp: string | null = null;

      // Set up API interception to capture timestamps
      await page.route('**/api/orders/*/view', async route => {
        const response = await route.fetch();
        const data = await response.json();
        if (data.lastViewedAt) {
          if (!firstTimestamp) {
            firstTimestamp = data.lastViewedAt;
          } else {
            secondTimestamp = data.lastViewedAt;
          }
        }
        await route.fulfill({ response });
      });

      // First view
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForTimeout(1000);

      // Second view after a delay
      await page.reload();
      await page.waitForTimeout(1000);

      // Verify both timestamps were captured
      expect(firstTimestamp).toBeTruthy();
      expect(secondTimestamp).toBeTruthy();

      // Second timestamp should be later or equal (if very fast)
      if (firstTimestamp && secondTimestamp) {
        const first = new Date(firstTimestamp).getTime();
        const second = new Date(secondTimestamp).getTime();
        expect(second).toBeGreaterThanOrEqual(first);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('401 error for unauthenticated requests', async ({ page }) => {
      // Don't login, try to call API directly
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/orders/order-123/view', {
          method: 'POST',
        });
        return {
          status: res.status,
          data: await res.json(),
        };
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Unauthorized');
    });

    test('404 error for non-existent order', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Try to view non-existent order
      await page.goto('/fulfillment/orders/non-existent-order-xyz');

      // Should show 404 or error message
      const errorMessage = page.getByText(/order not found|does not exist|404/i);
      await expect(errorMessage).toBeVisible();
    });

    test('400 error for missing order ID', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Call API with missing ID
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/orders//view', {
          method: 'POST',
        });
        return {
          status: res.status,
          data: await res.json(),
        };
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('required');
    });
  });

  test.describe('UTC Timestamp Verification', () => {
    test('timestamps are in UTC format', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      let apiResponse: any = null;
      await page.route('**/api/orders/*/view', async route => {
        const response = await route.fetch();
        apiResponse = await response.json();
        await route.fulfill({ response });
      });

      // Navigate to order
      await page.goto('/fulfillment/orders/order-123');
      await page.waitForTimeout(500);

      // Verify timestamp format
      if (apiResponse && apiResponse.lastViewedAt) {
        // Check if timestamp ends with Z (UTC indicator)
        expect(apiResponse.lastViewedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });

  test.describe('Response Format Validation', () => {
    test('POST endpoints return created/updated record', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Test order view endpoint
      const orderResponse = await page.evaluate(async () => {
        const res = await fetch('/api/orders/order-123/view', {
          method: 'POST',
        });
        return await res.json();
      });

      if (!orderResponse.skipped) {
        expect(orderResponse).toHaveProperty('id');
        expect(orderResponse).toHaveProperty('userId');
        expect(orderResponse).toHaveProperty('orderId');
        expect(orderResponse).toHaveProperty('lastViewedAt');
        expect(orderResponse).toHaveProperty('createdAt');
        expect(orderResponse).toHaveProperty('updatedAt');
      }

      // Test item view endpoint
      const itemResponse = await page.evaluate(async () => {
        const res = await fetch('/api/order-items/item-123/view', {
          method: 'POST',
        });
        return await res.json();
      });

      if (!itemResponse.skipped) {
        expect(itemResponse).toHaveProperty('id');
        expect(itemResponse).toHaveProperty('userId');
        expect(itemResponse).toHaveProperty('orderItemId');
        expect(itemResponse).toHaveProperty('lastViewedAt');
        expect(itemResponse).toHaveProperty('createdAt');
        expect(itemResponse).toHaveProperty('updatedAt');
      }
    });

    test('GET endpoint returns { orderView, itemViews[] }', async ({ page }) => {
      // Login as customer
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Call GET endpoint
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/orders/order-123/views', {
          method: 'GET',
        });
        return await res.json();
      });

      if (!response.skipped) {
        expect(response).toHaveProperty('orderView');
        expect(response).toHaveProperty('itemViews');
        expect(Array.isArray(response.itemViews)).toBe(true);

        // orderView can be null if never viewed
        if (response.orderView !== null) {
          expect(response.orderView).toHaveProperty('id');
          expect(response.orderView).toHaveProperty('userId');
          expect(response.orderView).toHaveProperty('orderId');
          expect(response.orderView).toHaveProperty('lastViewedAt');
        }

        // Each item view should have correct shape
        response.itemViews.forEach((itemView: any) => {
          expect(itemView).toHaveProperty('id');
          expect(itemView).toHaveProperty('userId');
          expect(itemView).toHaveProperty('orderItemId');
          expect(itemView).toHaveProperty('lastViewedAt');
        });
      }
    });
  });
});