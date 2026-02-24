import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Authentication Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Go to login page
    await loginPage.goto();

    // Login with valid credentials
    await loginPage.login('test@example.com', 'testpassword123');

    // Should be redirected to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify we're on the dashboard
    await dashboardPage.waitForPageLoad();
    await expect(dashboardPage.welcomeMessage).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Go to login page
    await loginPage.goto();

    // Try to login with invalid credentials
    await loginPage.login('invalid@example.com', 'wrongpassword');

    // Should show error message
    await loginPage.waitForError();
    const errorText = await loginPage.getErrorText();
    expect(errorText).toContain('Invalid credentials');
  });

  test('should prevent access to protected pages without login', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should be redirected to login page
    await page.waitForURL('**/login');

    // Verify we're on the login page
    const loginPage = new LoginPage(page);
    await expect(loginPage.emailInput).toBeVisible();
  });

  test('should successfully logout', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // First login
    await loginPage.goto();
    await loginPage.login('test@example.com', 'testpassword123');
    await page.waitForURL('**/dashboard');
    await dashboardPage.waitForPageLoad();

    // Now logout
    await dashboardPage.logout();

    // Should be redirected to login page
    await expect(loginPage.emailInput).toBeVisible();

    // Trying to access dashboard should redirect to login
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
  });

  test('should validate email format', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // Try to submit with invalid email
    await loginPage.login('not-an-email', 'password123');

    // Check for HTML5 validation or custom validation
    const emailInput = loginPage.emailInput;
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );

    expect(validationMessage).toBeTruthy();
  });

  test('should handle session timeout gracefully', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login('test@example.com', 'testpassword123');
    await page.waitForURL('**/dashboard');

    // Clear cookies to simulate session timeout
    await context.clearCookies();

    // Try to navigate to another protected page
    await page.goto('/customers');

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(loginPage.emailInput).toBeVisible();
  });
});