import { test as base } from '@playwright/test';

// Extend basic test by providing an authenticated page fixture
export const test = base.extend({
  // Override page fixture to automatically login
  page: async ({ page }, use) => {
    // Add login logic here if needed
    // For now, we'll use it without authentication
    await use(page);
  },

  // Add authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in login credentials
    // You'll need to adjust these based on your test data
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Use the authenticated page in tests
    await use(page);
  },
});

export { expect } from '@playwright/test';