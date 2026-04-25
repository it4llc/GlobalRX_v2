// /GlobalRX_v2/tests/e2e/candidate-invite-permission.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Candidate Invite Permission - E2E Tests', () => {

  test.describe('Permission-based UI visibility', () => {
    test('customer user with candidates.invite permission sees Invite Candidate button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user with the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-with-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Wait for dashboard to load
      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 3: Verify Invite Candidate button is visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).toBeVisible();
    });

    test('customer user without candidates.invite permission does not see Invite Candidate button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user without the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Wait for dashboard to load
      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 3: Verify Invite Candidate button is NOT visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).not.toBeVisible();
    });

    test('internal admin user automatically has permission to see Invite Candidate button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as admin user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Wait for dashboard to load
      await page.waitForURL(/\/dashboard|\/portal|\/fulfillment/);

      // Step 3: Verify Invite Candidate button is visible (admin has implicit permission)
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).toBeVisible();
    });

    test('vendor user never sees Invite Candidate button even with permission set', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Wait for vendor dashboard to load
      await page.waitForURL(/\/dashboard|\/vendor/);

      // Step 3: Verify Invite Candidate button is NOT visible (vendors can't invite)
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).not.toBeVisible();
    });
  });

  test.describe('API permission checks', () => {
    test('customer user with candidates.invite permission can create invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user with the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-with-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Call the API to create an invitation
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        }
      });

      // Step 3: Verify successful creation
      expect(response.status()).toBe(201);
      const invitation = await response.json();
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('token');
      expect(invitation.firstName).toBe('John');
      expect(invitation.lastName).toBe('Doe');
      expect(invitation.email).toBe('john.doe@example.com');
    });

    test('customer user without candidates.invite permission gets 403 when creating invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user without the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Try to call the API to create an invitation
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com'
        }
      });

      // Step 3: Verify permission denied
      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toBe("You don't have permission to create invitations");
    });

    test('internal admin user can create invitation with admin permission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as admin user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal|\/fulfillment/);

      // Step 2: Call the API to create an invitation (must provide customerId as admin)
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Admin',
          lastName: 'Test',
          email: 'admin.test@example.com',
          customerId: 'test-customer-id'
        }
      });

      // Step 3: Verify successful creation (admin has implicit permission)
      expect(response.status()).toBe(201);
      const invitation = await response.json();
      expect(invitation).toHaveProperty('id');
      expect(invitation.customerId).toBe('test-customer-id');
    });

    test('internal user with candidates.invite permission can create invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as internal user with specific permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal-with-invite@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal|\/fulfillment/);

      // Step 2: Call the API to create an invitation (must provide customerId)
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Internal',
          lastName: 'Created',
          email: 'internal.created@example.com',
          customerId: 'test-customer-id'
        }
      });

      // Step 3: Verify successful creation
      expect(response.status()).toBe(201);
      const invitation = await response.json();
      expect(invitation).toHaveProperty('id');
      expect(invitation.customerId).toBe('test-customer-id');
    });

    test('vendor user gets 403 when trying to create invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as vendor user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/vendor/);

      // Step 2: Try to call the API to create an invitation
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Vendor',
          lastName: 'Test',
          email: 'vendor.test@example.com'
        }
      });

      // Step 3: Verify permission denied (vendors can't invite)
      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toBe("You don't have permission to create invitations");
    });
  });

  test.describe('Customer isolation', () => {
    test('customer user with permission can only create invitations for their own customer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user with the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-with-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Try to create invitation for a different customer's package
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'other-customer-package-id',
          firstName: 'Cross',
          lastName: 'Customer',
          email: 'cross.customer@example.com'
        }
      });

      // Step 3: Verify access denied to other customer's package
      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toContain('Package not found'); // Should not be able to access other customer's package
    });

    test('customer user with permission cannot specify a different customerId', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user with the permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-with-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Try to create invitation with explicit different customerId
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Different',
          lastName: 'Customer',
          email: 'different.customer@example.com',
          customerId: 'other-customer-id' // Trying to specify different customer
        }
      });

      // Step 3: Verify forbidden - customer users can't create for other customers
      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toBe('Forbidden - cannot create invitation for another customer');
    });
  });

  test.describe('Permission edge cases', () => {
    test('user with malformed permissions object gets denied', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as user with malformed permissions
      await page.goto('/login');
      await page.fill('input[name="email"]', 'malformed-permissions@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Verify button is not visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).not.toBeVisible();

      // Step 3: Try API call - should be denied
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Malformed',
          lastName: 'Test',
          email: 'malformed.test@example.com'
        }
      });

      expect(response.status()).toBe(403);
    });

    test('user with candidates.invite explicitly set to false gets denied', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as user with permission explicitly denied
      await page.goto('/login');
      await page.fill('input[name="email"]', 'explicit-deny@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Verify button is not visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).not.toBeVisible();

      // Step 3: Try API call - should be denied
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Denied',
          lastName: 'Test',
          email: 'denied.test@example.com'
        }
      });

      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toBe("You don't have permission to create invitations");
    });

    test('unauthenticated user cannot create invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Don't login, just try to call the API
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Unauth',
          lastName: 'Test',
          email: 'unauth.test@example.com'
        }
      });

      // Should get 401 Unauthorized
      expect(response.status()).toBe(401);
      const error = await response.json();
      expect(error.error).toBe('Unauthorized');
    });

    test('customer user without customerId gets proper error', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user without customerId (edge case)
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-id@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Try to create invitation
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'NoId',
          lastName: 'Test',
          email: 'noid.test@example.com'
        }
      });

      // Step 3: Should get appropriate error about missing customerId
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.error).toContain('customer');
    });
  });

  test.describe('Integration with existing permissions', () => {
    test('user with candidate_workflow but not candidates.invite cannot create invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as user with old permission but not new one
      await page.goto('/login');
      await page.fill('input[name="email"]', 'old-permission@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Verify button is not visible (needs new permission)
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).not.toBeVisible();

      // Step 3: API call should be denied
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'OldPerm',
          lastName: 'Test',
          email: 'oldperm.test@example.com'
        }
      });

      expect(response.status()).toBe(403);
      const error = await response.json();
      expect(error.error).toBe("You don't have permission to create invitations");
    });

    test('user with both candidate_workflow and candidates.invite can create invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as user with both permissions
      await page.goto('/login');
      await page.fill('input[name="email"]', 'both-permissions@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 2: Verify button is visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), a:has-text("Invite Candidate")');
      await expect(inviteButton).toBeVisible();

      // Step 3: API call should succeed
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'BothPerms',
          lastName: 'Test',
          email: 'bothperms.test@example.com'
        }
      });

      expect(response.status()).toBe(201);
    });
  });
});