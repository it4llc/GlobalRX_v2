// /GlobalRX_v2/tests/e2e/candidate-login-session.spec.ts
// Pass 1 End-to-end tests for Phase 5 Stage 2 - Candidate Login & Session Management

import { test, expect } from '@playwright/test';

test.describe('Candidate Login & Session Management - E2E Tests', () => {

  test.describe('Returning Candidate Login Flow', () => {
    test('candidate with password sees login form instead of password creation form', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 1: Login form must only appear when hasPassword: true

      // Navigate to candidate landing page with token
      await page.goto('/candidate/abc123xyz');

      // Wait for page to load and API call to complete
      await page.waitForLoadState('networkidle');

      // Verify login form is displayed (not password creation form)
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).toBeVisible();

      // Business Rule 2: Should show welcome back greeting with first name
      await expect(page.locator('h1')).toContainText('Welcome back, Sarah');

      // Verify password creation form is NOT displayed
      const createPasswordForm = page.locator('[data-testid="create-password-form"]');
      await expect(createPasswordForm).not.toBeVisible();

      // Verify password field is present
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Verify Sign In button is present
      const signInButton = page.locator('button:has-text("Sign In")');
      await expect(signInButton).toBeVisible();

      // Business Rule 18: Forgot password link must be present
      const forgotLink = page.locator('a:has-text("Forgot your password?")');
      await expect(forgotLink).toBeVisible();
    });

    test('candidate can successfully login with correct password', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 3: Entering correct password logs candidate in

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Fill in password field
      await page.fill('input[type="password"]', 'MySecurePassword123');

      // Click Sign In button
      await page.click('button:has-text("Sign In")');

      // Business Rule 15: Should redirect to /candidate/[token]/portal
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Verify success page shows (temporary until Stage 3)
      await expect(page.locator('h1')).toContainText("You're logged in!");
      await expect(page.locator('text=Your application portal is coming soon')).toBeVisible();

      // Business Rule 7: Should have candidate_session cookie
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'candidate_session');
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie?.httpOnly).toBe(true);
      expect(sessionCookie?.secure).toBe(true);
      expect(sessionCookie?.sameSite).toBe('Lax');
    });

    test('candidate sees error message with incorrect password', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 4: Wrong password shows error and clears field

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Fill in wrong password
      await page.fill('input[type="password"]', 'WrongPassword123');

      // Click Sign In button
      await page.click('button:has-text("Sign In")');

      // Wait for error to appear
      await page.waitForSelector('[data-testid="login-error"]');

      // Business Rule 16: Non-specific error message
      const errorMessage = page.locator('[data-testid="login-error"]');
      await expect(errorMessage).toContainText('The password you entered is incorrect. Please try again.');

      // Password field should be cleared
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toHaveValue('');

      // Should still be on login page, not redirected
      await expect(page).toHaveURL(/\/candidate\/abc123xyz$/);
    });

    test('candidate is locked out after 5 failed login attempts', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 5: After 5 failed attempts, lockout for 15 minutes

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Attempt wrong password 5 times
      for (let i = 1; i <= 5; i++) {
        await page.fill('input[type="password"]', `WrongPassword${i}`);
        await page.click('button:has-text("Sign In")');

        if (i < 5) {
          // First 4 attempts show normal error
          await expect(page.locator('[data-testid="login-error"]')).toContainText('The password you entered is incorrect');
          await page.locator('input[type="password"]').clear();
        }
      }

      // 5th attempt should show lockout message
      // Business Rule 17: Lockout message
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Too many attempts. Please wait 15 minutes and try again.');

      // Sign In button should be disabled
      const signInButton = page.locator('button:has-text("Sign In")');
      await expect(signInButton).toBeDisabled();

      // Try a 6th attempt
      await page.fill('input[type="password"]', 'CorrectPasswordNow');
      await signInButton.click({ force: true }); // Force click even if disabled

      // Should still show lockout message
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Too many attempts');
    });

    test('expired invitation cannot login', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 2: Expired invitations must not allow login

      // Navigate to expired invitation token
      await page.goto('/candidate/expired-token-xyz');
      await page.waitForLoadState('networkidle');

      // Should show expiration message instead of login form
      await expect(page.locator('[data-testid="invitation-expired"]')).toBeVisible();
      await expect(page.locator('text=This invitation has expired')).toBeVisible();

      // Login form should NOT be visible
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).not.toBeVisible();
    });

    test('completed invitation cannot login', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 3: Invitations with status 'completed' must not allow login

      // Navigate to completed invitation token
      await page.goto('/candidate/completed-token-xyz');
      await page.waitForLoadState('networkidle');

      // Should show completion message instead of login form
      await expect(page.locator('[data-testid="invitation-completed"]')).toBeVisible();
      await expect(page.locator('text=already been submitted')).toBeVisible();

      // Login form should NOT be visible
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).not.toBeVisible();
    });

    test('invalid token shows error message', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 18: API does not reveal whether token exists

      await page.goto('/candidate/invalid-token-that-does-not-exist');
      await page.waitForLoadState('networkidle');

      // Should show generic error message
      await expect(page.locator('[data-testid="invitation-error"]')).toBeVisible();
      await expect(page.locator('text=invitation link is invalid')).toBeVisible();

      // Login form should NOT be visible
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).not.toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('successful login creates session and updates lastAccessedAt', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rules 6-8: Session creation and lastAccessedAt update

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Login successfully
      await page.fill('input[type="password"]', 'MySecurePassword123');

      // Intercept the API call to verify request and response
      const responsePromise = page.waitForResponse('**/api/candidate/auth/verify');
      await page.click('button:has-text("Sign In")');
      const response = await responsePromise;

      // Verify API response
      expect(response.status()).toBe(200);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.invitation).toHaveProperty('id');
      expect(responseData.invitation.firstName).toBe('Sarah');
      expect(responseData.invitation.status).toBe('accessed');
      expect(responseData.invitation.token).toBe('abc123xyz');

      // Verify session cookie was set
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'candidate_session');
      expect(sessionCookie).toBeTruthy();

      // Navigate to portal page
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Make session check API call
      const sessionResponse = await page.request.get('/api/candidate/auth/session');
      expect(sessionResponse.status()).toBe(200);
      const sessionData = await sessionResponse.json();
      expect(sessionData.authenticated).toBe(true);
      expect(sessionData.invitation.firstName).toBe('Sarah');
    });

    test('session check returns authenticated with valid session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 11: Session API returns candidate info

      // First, login to create a session
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'MySecurePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Now check the session API
      const sessionResponse = await page.request.get('/api/candidate/auth/session');
      expect(sessionResponse.status()).toBe(200);

      const sessionData = await sessionResponse.json();
      expect(sessionData).toEqual({
        authenticated: true,
        invitation: {
          id: expect.any(String),
          firstName: 'Sarah',
          status: 'accessed',
          token: 'abc123xyz'
        }
      });
    });

    test('session check returns unauthenticated without session cookie', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 12: No session returns unauthenticated

      // Clear all cookies first
      await page.context().clearCookies();

      // Try to check session without being logged in
      const sessionResponse = await page.request.get('/api/candidate/auth/session');
      expect(sessionResponse.status()).toBe(401);

      const sessionData = await sessionResponse.json();
      expect(sessionData).toEqual({
        authenticated: false
      });
    });

    test('sign out clears session and redirects to landing page', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Definition of Done 12: Sign out link works

      // First, login
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'MySecurePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Verify we're logged in
      await expect(page.locator('h1')).toContainText("You're logged in!");

      // Click sign out link
      await page.click('a:has-text("Sign Out")');

      // Should redirect back to landing page
      await page.waitForURL('**/candidate/abc123xyz');

      // Should show login form again (not logged in)
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).toBeVisible();

      // Session cookie should be cleared
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name === 'candidate_session');
      expect(sessionCookie).toBeUndefined();

      // Session check should return unauthenticated
      const sessionResponse = await page.request.get('/api/candidate/auth/session');
      const sessionData = await sessionResponse.json();
      expect(sessionData.authenticated).toBe(false);
    });

    test('expired session redirects to login', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 9: Sessions expire after 4 hours

      // This test simulates an expired session by manipulating the cookie
      // In a real scenario, we'd wait 4 hours or mock the time

      // First, login normally
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'MySecurePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Manipulate the cookie to simulate expiry (set an invalid/expired token)
      await page.context().addCookies([{
        name: 'candidate_session',
        value: 'expired_session_token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false, // false for localhost testing
        sameSite: 'Lax'
      }]);

      // Try to access portal with expired session
      await page.goto('/candidate/abc123xyz/portal');

      // Should redirect back to login page
      await page.waitForURL('**/candidate/abc123xyz');

      // Should show login form
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).toBeVisible();
    });

    test('session refreshes on each successful check', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 10: Session timer resets on each check

      // Login first
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'MySecurePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Get initial session cookie
      const cookies1 = await page.context().cookies();
      const sessionCookie1 = cookies1.find(c => c.name === 'candidate_session');
      expect(sessionCookie1).toBeTruthy();

      // Make a session check
      const sessionResponse1 = await page.request.get('/api/candidate/auth/session');
      expect(sessionResponse1.status()).toBe(200);

      // Wait a moment
      await page.waitForTimeout(1000);

      // Make another session check
      const sessionResponse2 = await page.request.get('/api/candidate/auth/session');
      expect(sessionResponse2.status()).toBe(200);

      // Cookie should still be valid (refreshed)
      const cookies2 = await page.context().cookies();
      const sessionCookie2 = cookies2.find(c => c.name === 'candidate_session');
      expect(sessionCookie2).toBeTruthy();

      // The expiry should be extended (implementation detail - cookie may be updated)
      // This verifies the session is still valid after multiple checks
      const sessionData = await sessionResponse2.json();
      expect(sessionData.authenticated).toBe(true);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('login form works on mobile viewport', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 14: Mobile-first design requirements

      // Set mobile viewport (iPhone 12)
      await page.setViewportSize({ width: 390, height: 844 });

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Login form should be visible
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).toBeVisible();

      // Check minimum width requirement (320px)
      const formBox = await loginForm.boundingBox();
      expect(formBox?.width).toBeGreaterThanOrEqual(320);

      // Password field should be visible and full width
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Business Rule 14: Password visibility toggle
      const toggleButton = page.locator('button[aria-label="Toggle password visibility"]');
      await expect(toggleButton).toBeVisible();

      // Check touch target size (minimum 44px)
      const toggleBox = await toggleButton.boundingBox();
      expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

      // Sign In button should be full width with minimum height
      const signInButton = page.locator('button:has-text("Sign In")');
      const signInBox = await signInButton.boundingBox();
      expect(signInBox?.height).toBeGreaterThanOrEqual(44);

      // Error messages should be readable (minimum 14px)
      await page.fill('input[type="password"]', 'wrong');
      await page.click('button:has-text("Sign In")');
      await page.waitForSelector('[data-testid="login-error"]');

      const errorElement = page.locator('[data-testid="login-error"]');
      const fontSize = await errorElement.evaluate(el =>
        window.getComputedStyle(el).fontSize
      );
      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14);
    });

    test('password visibility toggle works', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 14: Password visibility toggle

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      const passwordInput = page.locator('input[type="password"]');
      const toggleButton = page.locator('button[aria-label="Toggle password visibility"]');

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Type a password
      await passwordInput.fill('MyPassword123');

      // Click toggle to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      await expect(passwordInput).toHaveValue('MyPassword123');

      // Click toggle again to hide password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
      await expect(passwordInput).toHaveValue('MyPassword123');
    });

    test('login form does not require scrolling on mobile', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 14: No scrolling needed on standard phone

      // Set smaller mobile viewport (iPhone SE)
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Get the form container
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      const formBox = await loginForm.boundingBox();

      // Form should fit within viewport height
      expect(formBox?.height).toBeLessThanOrEqual(667);

      // Check that all key elements are visible without scrolling
      await expect(page.locator('h1:has-text("Welcome back")')).toBeInViewport();
      await expect(page.locator('input[type="password"]')).toBeInViewport();
      await expect(page.locator('button:has-text("Sign In")')).toBeInViewport();
      await expect(page.locator('a:has-text("Forgot your password?")')).toBeInViewport();
    });
  });

  test.describe('Forgot Password Flow', () => {
    test('forgot password link shows contact message', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 18: Forgot password shows contact message

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      // Click forgot password link
      await page.click('a:has-text("Forgot your password?")');

      // Should show message about contacting company
      await expect(page.locator('[data-testid="forgot-password-message"]')).toBeVisible();
      await expect(page.locator('text=Please contact the company that sent you this invitation to request a new link')).toBeVisible();

      // Should have a way to go back to login
      await page.click('button:has-text("Back to login")');

      // Should be back on login form
      const loginForm = page.locator('[data-testid="candidate-login-form"]');
      await expect(loginForm).toBeVisible();
    });
  });

  test.describe('Error Scenarios', () => {
    test('handles API errors gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Mock API to return server error
      await page.route('**/api/candidate/auth/verify', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      await page.fill('input[type="password"]', 'MyPassword123');
      await page.click('button:has-text("Sign In")');

      // Should show error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('text=An error occurred. Please try again.')).toBeVisible();

      // Should still be on login page
      await expect(page).toHaveURL(/\/candidate\/abc123xyz$/);
    });

    test('handles network timeout gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet

      // Mock API to delay response (simulate timeout)
      await page.route('**/api/candidate/auth/verify', async route => {
        await new Promise(resolve => setTimeout(resolve, 35000)); // 35 second delay
        route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request timeout' })
        });
      });

      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');

      await page.fill('input[type="password"]', 'MyPassword123');

      // Click sign in and wait for timeout
      await page.click('button:has-text("Sign In")');

      // Should show loading state initially
      await expect(page.locator('button:has-text("Sign In")')).toBeDisabled();

      // After timeout, should show error
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 40000 });
      await expect(page.locator('text=Request timed out. Please try again.')).toBeVisible();
    });

    test('handles invitation status change during session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 11: Session detects status changes

      // First, login successfully
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'MySecurePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Mock the session API to return that invitation is now completed
      await page.route('**/api/candidate/auth/session', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ authenticated: false })
        });
      });

      // Try to navigate to portal again (or refresh)
      await page.goto('/candidate/abc123xyz/portal');

      // Should redirect to landing page
      await page.waitForURL('**/candidate/abc123xyz');

      // Should show appropriate message (completed or expired)
      const statusMessage = page.locator('[data-testid="invitation-status-message"]');
      await expect(statusMessage).toBeVisible();
    });
  });

  test.describe('Security', () => {
    test('verify API does not reveal token existence', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 18: Same error for all invalid auth attempts

      // Test 1: Invalid token
      const response1 = await page.request.post('/api/candidate/auth/verify', {
        data: {
          token: 'completely-invalid-token',
          password: 'SomePassword123'
        }
      });
      expect(response1.status()).toBe(401);
      const data1 = await response1.json();
      expect(data1.error).toBe('Invalid credentials');

      // Test 2: Valid token but wrong password
      const response2 = await page.request.post('/api/candidate/auth/verify', {
        data: {
          token: 'abc123xyz',
          password: 'WrongPassword123'
        }
      });
      expect(response2.status()).toBe(401);
      const data2 = await response2.json();
      expect(data2.error).toBe('Invalid credentials');

      // Test 3: Valid token but no password set
      const response3 = await page.request.post('/api/candidate/auth/verify', {
        data: {
          token: 'token-without-password',
          password: 'AnyPassword123'
        }
      });
      expect(response3.status()).toBe(401);
      const data3 = await response3.json();
      expect(data3.error).toBe('Invalid credentials');

      // All three should return identical error messages
      expect(data1.error).toBe(data2.error);
      expect(data2.error).toBe(data3.error);
    });

    test('candidate session does not interfere with regular user session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 9: Separate cookies for candidate and user sessions

      // First, login as a regular user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/fulfillment/);

      // Get user session cookie
      const cookies1 = await page.context().cookies();
      const userSessionCookie = cookies1.find(c => c.name === 'next-auth.session-token');
      expect(userSessionCookie).toBeTruthy();

      // Now navigate to candidate page and login as candidate
      await page.goto('/candidate/abc123xyz');
      await page.waitForLoadState('networkidle');
      await page.fill('input[type="password"]', 'CandidatePassword123');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('**/candidate/abc123xyz/portal');

      // Get both cookies
      const cookies2 = await page.context().cookies();
      const candidateSessionCookie = cookies2.find(c => c.name === 'candidate_session');
      const userSessionStillThere = cookies2.find(c => c.name === 'next-auth.session-token');

      // Both sessions should exist independently
      expect(candidateSessionCookie).toBeTruthy();
      expect(userSessionStillThere).toBeTruthy();
      expect(candidateSessionCookie?.value).not.toBe(userSessionStillThere?.value);

      // Navigate back to admin area - should still be logged in as admin
      await page.goto('/fulfillment');
      await expect(page).toHaveURL('/fulfillment');

      // Navigate back to candidate area - should still be logged in as candidate
      await page.goto('/candidate/abc123xyz/portal');
      await expect(page).toHaveURL(/\/candidate\/abc123xyz\/portal/);
    });

    test('candidate auth APIs do not use NextAuth', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Business Rule 13: Candidate APIs independent of NextAuth

      // Clear all cookies to ensure no NextAuth session
      await page.context().clearCookies();

      // Candidate verify API should work without NextAuth session
      const verifyResponse = await page.request.post('/api/candidate/auth/verify', {
        data: {
          token: 'abc123xyz',
          password: 'MyPassword123'
        }
      });

      // Should process request (may fail auth, but shouldn't require NextAuth)
      expect([200, 401, 429]).toContain(verifyResponse.status());

      // Candidate session API should work without NextAuth session
      const sessionResponse = await page.request.get('/api/candidate/auth/session');

      // Should return unauthenticated, not a NextAuth error
      expect(sessionResponse.status()).toBe(401);
      const sessionData = await sessionResponse.json();
      expect(sessionData).toHaveProperty('authenticated', false);
    });
  });
});