// /GlobalRX_v2/tests/e2e/order-view-tracking-phase-2c.spec.ts
// End-to-end tests for Order View Tracking Phase 2C - UI Wiring
// These tests verify that the frontend correctly calls the view tracking APIs

import { test, expect } from '@playwright/test';

test.describe('Order View Tracking Phase 2C - E2E Tests', () => {

  test.describe('Order View Tracking', () => {
    test('should fire view tracking API when customer navigates to order details', async ({ page }) => {
      // Step 1: Set up API response monitoring
      const orderViewRequests: any[] = [];

      await page.route('**/api/orders/*/view', (route) => {
        orderViewRequests.push({
          method: route.request().method(),
          url: route.request().url(),
          headers: route.request().headers()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock order details API response
      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            statusCode: 'processing',
            subject: { firstName: 'John', lastName: 'Doe' },
            customer: { id: 'customer-123', name: 'ACME Corp' },
            createdAt: '2024-03-01T09:00:00Z',
            updatedAt: '2024-03-01T09:00:00Z'
          })
        });
      });

      // Step 2: Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 3: Navigate to order details page
      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');

      // Step 4: Wait for page to load
      await expect(page.getByText('20240301-ABC-0001')).toBeVisible();

      // Step 5: Verify that order view tracking API was called exactly once
      await page.waitForTimeout(1000); // Allow time for tracking call

      expect(orderViewRequests).toHaveLength(1);
      expect(orderViewRequests[0].method).toBe('POST');
      expect(orderViewRequests[0].url).toContain('/api/orders/550e8400-e29b-41d4-a716-446655440001/view');
      expect(orderViewRequests[0].headers['content-type']).toBe('application/json');
    });

    test('should only fire view tracking once per page mount even on order data refresh', async ({ page }) => {
      const orderViewRequests: any[] = [];

      await page.route('**/api/orders/*/view', (route) => {
        orderViewRequests.push({
          timestamp: Date.now(),
          url: route.request().url()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock order details API with different responses for multiple calls
      let callCount = 0;
      await page.route('**/api/fulfillment/orders/*', (route) => {
        callCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            statusCode: callCount === 1 ? 'processing' : 'submitted',
            subject: { firstName: 'John', lastName: 'Doe' },
            customer: { id: 'customer-123', name: 'ACME Corp' },
            createdAt: '2024-03-01T09:00:00Z',
            updatedAt: callCount === 1 ? '2024-03-01T09:00:00Z' : '2024-03-01T10:00:00Z'
          })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('20240301-ABC-0001')).toBeVisible();

      // Simulate a data refresh that might trigger useEffect again
      await page.reload();
      await expect(page.getByText('20240301-ABC-0001')).toBeVisible();

      // Wait for any additional tracking calls
      await page.waitForTimeout(1500);

      // Should only have 2 calls total (once per page mount/reload)
      expect(orderViewRequests).toHaveLength(2);
    });

    test('should fire new tracking call when navigating to different order', async ({ page }) => {
      const orderViewRequests: any[] = [];

      await page.route('**/api/orders/*/view', (route) => {
        orderViewRequests.push({
          url: route.request().url()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock different order responses
      await page.route('**/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            statusCode: 'processing',
            subject: { firstName: 'John', lastName: 'Doe' },
            customer: { id: 'customer-123', name: 'ACME Corp' },
            createdAt: '2024-03-01T09:00:00Z',
            updatedAt: '2024-03-01T09:00:00Z'
          })
        });
      });

      await page.route('**/api/fulfillment/orders/660e8400-e29b-41d4-a716-446655440002', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '660e8400-e29b-41d4-a716-446655440002',
            orderNumber: '20240301-XYZ-0002',
            statusCode: 'submitted',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            customer: { id: 'customer-456', name: 'Tech Corp' },
            createdAt: '2024-03-01T10:00:00Z',
            updatedAt: '2024-03-01T10:00:00Z'
          })
        });
      });

      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to first order
      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('20240301-ABC-0001')).toBeVisible();

      // Navigate to second order
      await page.goto('/fulfillment/orders/660e8400-e29b-41d4-a716-446655440002');
      await expect(page.getByText('20240301-XYZ-0002')).toBeVisible();

      // Wait for tracking calls
      await page.waitForTimeout(1000);

      // Should have tracking calls for both orders
      expect(orderViewRequests).toHaveLength(2);
      expect(orderViewRequests[0].url).toContain('550e8400-e29b-41d4-a716-446655440001');
      expect(orderViewRequests[1].url).toContain('660e8400-e29b-41d4-a716-446655440002');
    });
  });

  test.describe('Order Item View Tracking', () => {
    test('should fire view tracking API when expanding order item rows', async ({ page }) => {
      const orderItemViewRequests: any[] = [];

      await page.route('**/api/order-items/*/view', (route) => {
        orderItemViewRequests.push({
          method: route.request().method(),
          url: route.request().url(),
          headers: route.request().headers()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock order view tracking
      await page.route('**/api/orders/*/view', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock order details with services
      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            statusCode: 'processing',
            subject: { firstName: 'John', lastName: 'Doe' },
            customer: { id: 'customer-123', name: 'ACME Corp' },
            services: [
              {
                id: 'service-1',
                orderItemId: '660e8400-e29b-41d4-a716-446655440001',
                service: { name: 'Criminal Background Check' },
                location: { name: 'National' },
                status: 'submitted'
              },
              {
                id: 'service-2',
                orderItemId: '660e8400-e29b-41d4-a716-446655440002',
                service: { name: 'Employment Verification' },
                location: { name: 'Previous Employer' },
                status: 'processing'
              }
            ],
            createdAt: '2024-03-01T09:00:00Z',
            updatedAt: '2024-03-01T09:00:00Z'
          })
        });
      });

      // Login and navigate to order
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('Criminal Background Check')).toBeVisible();

      // Find and click expand button for first service
      const expandButton = page.locator('button[aria-label*="Toggle details for Criminal Background Check"]').first();
      await expandButton.click();

      // Wait for tracking call
      await page.waitForTimeout(500);

      // Verify order item view tracking was called
      expect(orderItemViewRequests).toHaveLength(1);
      expect(orderItemViewRequests[0].method).toBe('POST');
      expect(orderItemViewRequests[0].url).toContain('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view');
      expect(orderItemViewRequests[0].headers['content-type']).toBe('application/json');
    });

    test('should NOT fire tracking call when collapsing order item rows', async ({ page }) => {
      const orderItemViewRequests: any[] = [];

      await page.route('**/api/order-items/*/view', (route) => {
        orderItemViewRequests.push({
          timestamp: Date.now(),
          action: 'expand'
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock other APIs
      await page.route('**/api/orders/*/view', (route) => {
        route.fulfill({ status: 200, body: '{}' });
      });

      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            services: [{
              id: 'service-1',
              orderItemId: '660e8400-e29b-41d4-a716-446655440001',
              service: { name: 'Criminal Background Check' },
              location: { name: 'National' },
              status: 'submitted'
            }]
          })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('Criminal Background Check')).toBeVisible();

      // Expand the row
      const expandButton = page.locator('button[aria-label*="Toggle details for Criminal Background Check"]').first();
      await expandButton.click();

      // Wait for expand tracking call
      await page.waitForTimeout(500);
      expect(orderItemViewRequests).toHaveLength(1);

      // Clear the requests array to track only collapse actions
      orderItemViewRequests.length = 0;

      // Collapse the row
      await expandButton.click();

      // Wait to ensure no collapse tracking call is made
      await page.waitForTimeout(500);

      // Should not have any new tracking calls for collapse
      expect(orderItemViewRequests).toHaveLength(0);
    });

    test('should fire tracking call each time the same row is expanded', async ({ page }) => {
      const orderItemViewRequests: any[] = [];

      await page.route('**/api/order-items/*/view', (route) => {
        orderItemViewRequests.push({
          timestamp: Date.now(),
          url: route.request().url()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Mock other APIs
      await page.route('**/api/orders/*/view', (route) => {
        route.fulfill({ status: 200, body: '{}' });
      });

      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            services: [{
              id: 'service-1',
              orderItemId: '660e8400-e29b-41d4-a716-446655440001',
              service: { name: 'Criminal Background Check' },
              location: { name: 'National' },
              status: 'submitted'
            }]
          })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('Criminal Background Check')).toBeVisible();

      const expandButton = page.locator('button[aria-label*="Toggle details for Criminal Background Check"]').first();

      // Expand first time
      await expandButton.click();
      await page.waitForTimeout(300);

      // Collapse
      await expandButton.click();
      await page.waitForTimeout(300);

      // Expand second time
      await expandButton.click();
      await page.waitForTimeout(300);

      // Should have 2 tracking calls (no client-side deduplication)
      expect(orderItemViewRequests).toHaveLength(2);
      expect(orderItemViewRequests[0].url).toContain('660e8400-e29b-41d4-a716-446655440001');
      expect(orderItemViewRequests[1].url).toContain('660e8400-e29b-41d4-a716-446655440001');
    });
  });

  test.describe('Silent Failure Handling', () => {
    test('should render page normally when order view tracking fails', async ({ page }) => {
      // Mock order tracking to fail
      await page.route('**/api/orders/*/view', (route) => {
        route.abort('failed');
      });

      // Mock order details to succeed
      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            statusCode: 'processing',
            subject: { firstName: 'John', lastName: 'Doe' },
            customer: { id: 'customer-123', name: 'ACME Corp' },
            createdAt: '2024-03-01T09:00:00Z',
            updatedAt: '2024-03-01T09:00:00Z'
          })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');

      // Page should load normally despite tracking failure
      await expect(page.getByText('20240301-ABC-0001')).toBeVisible();
      await expect(page.getByText('John Doe')).toBeVisible();

      // No error message should be visible to user
      await expect(page.locator('text=error')).not.toBeVisible();
      await expect(page.locator('text=failed')).not.toBeVisible();
    });

    test('should allow row expansion when order item tracking fails', async ({ page }) => {
      // Mock order view tracking to succeed
      await page.route('**/api/orders/*/view', (route) => {
        route.fulfill({ status: 200, body: '{}' });
      });

      // Mock order item tracking to fail
      await page.route('**/api/order-items/*/view', (route) => {
        route.abort('failed');
      });

      // Mock order details to succeed
      await page.route('**/api/fulfillment/orders/*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: '550e8400-e29b-41d4-a716-446655440001',
            orderNumber: '20240301-ABC-0001',
            services: [{
              id: 'service-1',
              orderItemId: '660e8400-e29b-41d4-a716-446655440001',
              service: { name: 'Criminal Background Check' },
              location: { name: 'National' },
              status: 'submitted'
            }]
          })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      await expect(page.getByText('Criminal Background Check')).toBeVisible();

      // Expand button should work despite tracking failure
      const expandButton = page.locator('button[aria-label*="Toggle details for Criminal Background Check"]').first();
      await expandButton.click();

      // Row should expand successfully (look for expanded content)
      // The actual content depends on the implementation, but the row should show additional details
      await expect(page.locator('[data-testid*="service-expanded"]').first()).toBeVisible();

      // No error message should be shown to user
      await expect(page.locator('text=error')).not.toBeVisible();
      await expect(page.locator('text=tracking')).not.toBeVisible();
    });
  });

  test.describe('API Call Format Verification', () => {
    test('should use plain fetch with exact format specified in spec', async ({ page }) => {
      const apiCalls: any[] = [];

      // Capture all API calls
      await page.route('**/api/**', (route) => {
        apiCalls.push({
          method: route.request().method(),
          url: route.request().url(),
          headers: route.request().headers(),
          body: route.request().postData()
        });
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Login and navigate
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@acmecorp.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');

      // Wait for API calls to complete
      await page.waitForTimeout(1000);

      // Find the order view tracking call
      const orderViewCall = apiCalls.find(call =>
        call.url.includes('/api/orders/') && call.url.endsWith('/view')
      );

      expect(orderViewCall).toBeDefined();
      expect(orderViewCall.method).toBe('POST');
      expect(orderViewCall.headers['content-type']).toBe('application/json');
      // Body should be empty (endpoint uses session for user identification)
      expect(orderViewCall.body).toBeUndefined();
    });
  });
});