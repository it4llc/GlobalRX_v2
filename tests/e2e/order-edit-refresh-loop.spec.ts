// /GlobalRX_v2/tests/e2e/order-edit-refresh-loop.spec.ts
import { test, expect, Page } from '@playwright/test';

/**
 * E2E test for the infinite refresh loop bug when editing orders
 *
 * BUG DESCRIPTION:
 * When editing an order, the loadOrderForEdit function is recreated on every render
 * due to unstable dependencies (serviceCart and requirementsHook objects), causing
 * the useEffect to fire repeatedly and create an infinite loop.
 */

test.describe('Order Edit Refresh Loop Bug', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Login as a customer user who can edit orders
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to portal
    await page.waitForURL('**/portal/**');
  });

  test('MUST FAIL: demonstrates infinite refresh loop when editing an order', async () => {
    // Navigate to orders list
    await page.goto('/portal/orders');

    // Find a draft order and click edit
    const draftOrderRow = page.locator('tr').filter({ hasText: 'Draft' }).first();
    await expect(draftOrderRow).toBeVisible();

    const editButton = draftOrderRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Should navigate to edit page with ?edit= parameter
    await expect(page).toHaveURL(/\/portal\/orders\/new\?edit=/);

    // Track network requests to detect refresh loop
    let loadOrderRequestCount = 0;
    const orderId = new URL(page.url()).searchParams.get('edit');

    page.on('request', request => {
      if (request.url().includes(`/api/portal/orders/${orderId}`) &&
          request.method() === 'GET') {
        loadOrderRequestCount++;
      }
    });

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // Record initial request count
    const initialRequestCount = loadOrderRequestCount;
    expect(initialRequestCount).toBeGreaterThan(0);

    // Wait 3 seconds - during this time, the bug causes multiple refreshes
    await page.waitForTimeout(3000);

    // BUG PROOF: The order endpoint is called multiple times instead of once
    expect(loadOrderRequestCount).toBeGreaterThan(initialRequestCount + 2);

    console.log(`BUG CONFIRMED: Order loaded ${loadOrderRequestCount} times instead of once!`);

    // Additional symptom: Performance degradation
    // Check if the page is responsive
    const startTime = Date.now();
    await page.click('body'); // Simple interaction
    const responseTime = Date.now() - startTime;

    // With the infinite loop, the page becomes slow to respond
    expect(responseTime).toBeGreaterThan(100); // Slow response due to constant re-rendering
  });

  test('MUST FAIL: shows console.log violations during order form interaction', async () => {
    // Navigate to new order page
    await page.goto('/portal/orders/new');

    // Set up console message listener
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Add at least one service to pass validation
    await page.click('button:has-text("Add Service")');
    await page.waitForSelector('[data-testid="service-modal"]');
    await page.click('[data-testid="service-checkbox"]:first');
    await page.click('button:has-text("Confirm")');

    // Click Next to trigger handleNext function
    await page.click('button:has-text("Next")');

    // BUG PROOF: console.log statements are present
    const violatingMessages = consoleMessages.filter(msg =>
      msg.includes('handleNext') ||
      msg.includes('clientLogger') ||
      msg.includes('after clientLogger')
    );

    expect(violatingMessages.length).toBeGreaterThan(0);
    console.log(`BUG CONFIRMED: Found ${violatingMessages.length} console.log violations!`);
    console.log('Violations:', violatingMessages);
  });

  test('Expected: edit order loads once and remains stable', async () => {
    // This test describes the expected behavior after the bug is fixed

    // Navigate to orders list
    await page.goto('/portal/orders');

    // Find and edit a draft order
    const draftOrderRow = page.locator('tr').filter({ hasText: 'Draft' }).first();
    await expect(draftOrderRow).toBeVisible();

    const editButton = draftOrderRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Should navigate to edit page
    await expect(page).toHaveURL(/\/portal\/orders\/new\?edit=/);

    // Track network requests
    let loadOrderRequestCount = 0;
    const orderId = new URL(page.url()).searchParams.get('edit');

    page.on('request', request => {
      if (request.url().includes(`/api/portal/orders/${orderId}`) &&
          request.method() === 'GET') {
        loadOrderRequestCount++;
      }
    });

    // Wait for initial load
    await page.waitForLoadState('networkidle');

    // EXPECTED: Order should be loaded exactly once
    expect(loadOrderRequestCount).toBe(1);

    // Wait to ensure no additional requests
    await page.waitForTimeout(2000);

    // EXPECTED: Still only one request
    expect(loadOrderRequestCount).toBe(1);

    // EXPECTED: Page should be responsive
    const startTime = Date.now();
    await page.click('body');
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(50); // Quick response, no performance issues
  });

  test('Expected: no console statements during order form usage', async () => {
    // Navigate to new order page
    await page.goto('/portal/orders/new');

    // Set up console listener
    const consoleViolations: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        const text = msg.text();
        // Check for debugging console statements (not legitimate warnings)
        if (text.includes('console.') ||
            text.includes('handleNext') ||
            text.includes('clientLogger.debug failed')) {
          consoleViolations.push(text);
        }
      }
    });

    // Interact with the form
    await page.click('button:has-text("Add Service")');
    await page.waitForSelector('[data-testid="service-modal"]');
    await page.click('[data-testid="service-checkbox"]:first');
    await page.click('button:has-text("Confirm")');
    await page.click('button:has-text("Next")');

    // EXPECTED: No console violations
    expect(consoleViolations.length).toBe(0);
  });

  test('Edge case: handles changing edit ID without refresh loop', async () => {
    // Start editing one order
    await page.goto('/portal/orders/new?edit=order-1');

    let requestCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/portal/orders/') &&
          request.method() === 'GET') {
        requestCount++;
      }
    });

    await page.waitForLoadState('networkidle');
    const firstOrderRequests = requestCount;

    // Change to edit a different order via URL
    await page.goto('/portal/orders/new?edit=order-2');
    await page.waitForLoadState('networkidle');

    const totalRequests = requestCount;
    const secondOrderRequests = totalRequests - firstOrderRequests;

    // EXPECTED: Each order loaded exactly once
    expect(firstOrderRequests).toBe(1);
    expect(secondOrderRequests).toBe(1);
  });

  test('Edge case: non-draft order shows error and redirects', async () => {
    // Attempt to edit a submitted order (should fail)
    await page.goto('/portal/orders');

    // Find a submitted order
    const submittedOrderRow = page.locator('tr').filter({ hasText: 'Submitted' }).first();

    if (await submittedOrderRow.count() > 0) {
      // If there's a submitted order, try to edit it via URL manipulation
      const orderId = await submittedOrderRow.getAttribute('data-order-id');

      if (orderId) {
        await page.goto(`/portal/orders/new?edit=${orderId}`);

        // EXPECTED: Should show error and redirect
        await expect(page.locator('.error-message')).toContainText('Only draft orders can be edited');
        await expect(page).toHaveURL('/portal/orders');
      }
    }
  });
});

test.describe('Performance Impact of Refresh Loop', () => {
  test('measures performance degradation from infinite loop', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/portal/**');

    // Navigate to edit page
    await page.goto('/portal/orders');
    const draftOrder = page.locator('tr').filter({ hasText: 'Draft' }).first();
    await draftOrder.locator('button:has-text("Edit")').click();

    // Measure CPU usage via Performance API
    const metrics = await page.evaluate(() => {
      return new Promise(resolve => {
        const startTime = performance.now();
        let renderCount = 0;

        // Use MutationObserver to detect DOM changes (re-renders)
        const observer = new MutationObserver(() => {
          renderCount++;
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        // Measure for 2 seconds
        setTimeout(() => {
          observer.disconnect();
          const endTime = performance.now();
          resolve({
            duration: endTime - startTime,
            renderCount: renderCount,
            memoryUsage: (performance as any).memory ? (performance as any).memory.usedJSHeapSize : null
          });
        }, 2000);
      });
    });

    // BUG INDICATOR: Excessive re-renders
    expect(metrics.renderCount).toBeGreaterThan(10);
    console.log(`Performance impact: ${metrics.renderCount} renders in 2 seconds`);
  });
});