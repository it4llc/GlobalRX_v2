// /GlobalRX_v2/tests/e2e/candidate-invitation-foundation.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Candidate Invitation Foundation - E2E Tests', () => {

  test.describe('Create Invitation', () => {
    test('customer user can create a new invitation with all fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to candidate invitation creation
      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 3: Call the API directly since there's no UI yet
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneCountryCode: '+1',
          phoneNumber: '5551234567'
        }
      });

      // Step 4: Verify response
      expect(response.status()).toBe(201);
      const invitation = await response.json();

      // Verify invitation has required fields
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('token');
      expect(invitation).toHaveProperty('orderId');
      expect(invitation.firstName).toBe('John');
      expect(invitation.lastName).toBe('Doe');
      expect(invitation.email).toBe('john.doe@example.com');
      expect(invitation.status).toBe('sent');
      expect(invitation.phoneCountryCode).toBe('+1');
      expect(invitation.phoneNumber).toBe('5551234567');

      // Verify expiration is in the future
      const expiresAt = new Date(invitation.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('customer user can create invitation without phone fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com'
        }
      });

      expect(response.status()).toBe(201);
      const invitation = await response.json();
      expect(invitation.firstName).toBe('Jane');
      expect(invitation.lastName).toBe('Smith');
      expect(invitation.email).toBe('jane.smith@example.com');
      expect(invitation.phoneCountryCode).toBeNull();
      expect(invitation.phoneNumber).toBeNull();
    });

    test('internal admin user can create invitation with customerId', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal|\/fulfillment/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'Admin',
          lastName: 'Created',
          email: 'admin.created@example.com',
          customerId: 'test-customer-id'
        }
      });

      expect(response.status()).toBe(201);
      const invitation = await response.json();
      expect(invitation.customerId).toBe('test-customer-id');
    });

    test('fails when package does not exist', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'non-existent-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });

      expect(response.status()).toBe(404);
    });

    test('fails when package has no active workflow', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'package-without-workflow',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });

      expect(response.status()).toBe(422);
      const error = await response.json();
      expect(error.error).toContain('workflow');
    });

    test('fails when package belongs to different customer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'other-customer-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });

      expect(response.status()).toBe(403);
    });

    test('fails when required fields are missing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Missing firstName
      let response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });
      expect(response.status()).toBe(400);

      // Missing email
      response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe'
        }
      });
      expect(response.status()).toBe(400);
    });

    test('fails when not authenticated', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Look Up Invitation by Token', () => {
    test('can look up invitation without authentication', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-invitation-token-123';

      const response = await page.request.get(`/api/candidate/invitations/${testToken}`);

      // Should work without authentication
      expect(response.status()).toBe(200);
      const invitation = await response.json();

      // Should return invitation details
      expect(invitation).toHaveProperty('id');
      expect(invitation).toHaveProperty('status');
      expect(invitation).toHaveProperty('firstName');
      expect(invitation).toHaveProperty('lastName');
      expect(invitation).toHaveProperty('email');
      expect(invitation).toHaveProperty('expiresAt');
      expect(invitation).toHaveProperty('orderId');
      expect(invitation).toHaveProperty('customerId');

      // Should NOT return sensitive fields
      expect(invitation).not.toHaveProperty('token');
      expect(invitation).not.toHaveProperty('passwordHash');
    });

    test('returns 404 for non-existent token', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const response = await page.request.get('/api/candidate/invitations/non-existent-token');

      expect(response.status()).toBe(404);
    });

    test('updates status to expired when past expiration date', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const expiredToken = 'expired-invitation-token';

      const response = await page.request.get(`/api/candidate/invitations/${expiredToken}`);

      expect(response.status()).toBe(200);
      const invitation = await response.json();

      // Should have expired status
      expect(invitation.status).toBe('expired');

      // Expiration date should be in the past
      const expiresAt = new Date(invitation.expiresAt);
      expect(expiresAt.getTime()).toBeLessThan(Date.now());
    });
  });

  test.describe('Extend Invitation', () => {
    test('customer user can extend invitation with specific days', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'test-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/extend`, {
        data: { days: 7 }
      });

      expect(response.status()).toBe(200);
      const invitation = await response.json();

      // Verify expiration was extended
      const expiresAt = new Date(invitation.expiresAt);
      const daysUntilExpiration = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(daysUntilExpiration).toBeGreaterThanOrEqual(6);
      expect(daysUntilExpiration).toBeLessThanOrEqual(8);
    });

    test('customer user can extend without specifying days (uses workflow default)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'test-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/extend`, {
        data: {}
      });

      expect(response.status()).toBe(200);
      const invitation = await response.json();

      // Should have extended expiration
      const expiresAt = new Date(invitation.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('extending expired invitation restores previous status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const expiredInvitationId = 'expired-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${expiredInvitationId}/extend`, {
        data: { days: 10 }
      });

      expect(response.status()).toBe(200);
      const invitation = await response.json();

      // Status should be restored (not 'expired' anymore)
      expect(invitation.status).not.toBe('expired');
      expect(['sent', 'opened']).toContain(invitation.status);

      // Should have new future expiration
      const expiresAt = new Date(invitation.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('fails when days is less than 1', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'test-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/extend`, {
        data: { days: 0 }
      });

      expect(response.status()).toBe(400);
    });

    test('fails when days is greater than 15', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'test-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/extend`, {
        data: { days: 16 }
      });

      expect(response.status()).toBe(400);
    });

    test('fails when invitation is completed', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const completedInvitationId = 'completed-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${completedInvitationId}/extend`, {
        data: { days: 7 }
      });

      expect(response.status()).toBe(422);
    });

    test('fails when invitation does not exist', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations/non-existent-id/extend', {
        data: { days: 7 }
      });

      expect(response.status()).toBe(404);
    });

    test('fails when invitation belongs to different customer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const otherCustomerInvitationId = 'other-customer-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${otherCustomerInvitationId}/extend`, {
        data: { days: 7 }
      });

      expect(response.status()).toBe(403);
    });

    test('fails when not authenticated', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const response = await page.request.post('/api/candidate/invitations/test-id/extend', {
        data: { days: 7 }
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Resend Invitation', () => {
    test('customer user can resend invitation with sent status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'sent-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/resend`);

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    test('customer user can resend invitation with opened status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const invitationId = 'opened-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${invitationId}/resend`);

      expect(response.status()).toBe(200);
    });

    test('fails when invitation is expired', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const expiredInvitationId = 'expired-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${expiredInvitationId}/resend`);

      expect(response.status()).toBe(422);
      const error = await response.json();
      expect(error.error).toContain('expired');
    });

    test('fails when invitation is in_progress', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const inProgressInvitationId = 'in-progress-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${inProgressInvitationId}/resend`);

      expect(response.status()).toBe(422);
    });

    test('fails when invitation is completed', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const completedInvitationId = 'completed-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${completedInvitationId}/resend`);

      expect(response.status()).toBe(422);
    });

    test('fails when invitation does not exist', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations/non-existent-id/resend');

      expect(response.status()).toBe(404);
    });

    test('fails when invitation belongs to different customer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const otherCustomerInvitationId = 'other-customer-invitation-id';
      const response = await page.request.post(`/api/candidate/invitations/${otherCustomerInvitationId}/resend`);

      expect(response.status()).toBe(403);
    });

    test('fails when not authenticated', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const response = await page.request.post('/api/candidate/invitations/test-id/resend');

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Business Rules Validation', () => {
    test('email is normalized to lowercase', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'John.Doe@EXAMPLE.COM'  // Mixed case email
        }
      });

      expect(response.status()).toBe(201);
      const invitation = await response.json();

      // Email should be normalized to lowercase
      expect(invitation.email).toBe('john.doe@example.com');
    });

    test('invitation creates order in draft status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        }
      });

      expect(response.status()).toBe(201);
      const invitation = await response.json();

      // Should have created an order
      expect(invitation.orderId).toBeTruthy();

      // Check the order status via orders API (if accessible)
      const orderResponse = await page.request.get(`/api/orders/${invitation.orderId}`);
      if (orderResponse.ok()) {
        const order = await orderResponse.json();
        expect(order.status).toBe('draft');
      }
    });

    test('token is cryptographically secure and unique', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/dashboard|\/portal/);

      // Create multiple invitations
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        const response = await page.request.post('/api/candidate/invitations', {
          data: {
            packageId: 'test-package-id',
            firstName: `User${i}`,
            lastName: 'Test',
            email: `user${i}@example.com`
          }
        });

        expect(response.status()).toBe(201);
        const invitation = await response.json();
        tokens.push(invitation.token);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Tokens should have sufficient length/complexity (at least 20 chars)
      tokens.forEach(token => {
        expect(token.length).toBeGreaterThanOrEqual(20);
        // Should not be sequential or predictable
        expect(token).not.toMatch(/^[0-9]+$/);
        expect(token).not.toMatch(/^test/);
      });
    });
  });
});