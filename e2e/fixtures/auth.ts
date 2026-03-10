import { test as base, Page } from '@playwright/test';

type AuthFixtures = {
  authenticatedPage: Page;
};

// Extend basic test by providing an authenticated page fixture
export const test = base.extend<AuthFixtures>({
  // Add authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in login credentials using the seeded test data
    await page.fill('input[name="email"]', 'customer@acmecorp.com');
    await page.fill('input[name="password"]', 'password123');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to complete - customers go to portal/dashboard, others to dashboard/fulfillment
    await page.waitForURL(/\/(portal\/dashboard|dashboard|fulfillment)/, { timeout: 10000 });

    // Use the authenticated page in tests
    await use(page);
  },
});

export { expect } from '@playwright/test';