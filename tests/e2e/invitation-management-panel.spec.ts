// /GlobalRX_v2/tests/e2e/invitation-management-panel.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Invitation Management Panel - E2E Tests', () => {

  test.describe('Invitation Status Section Visibility', () => {
    test('shows invitation status section for orders with linked invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as internal user with fulfillment permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to order with linked invitation
      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-invitation');

      // Step 3: Verify Invitation Status section is visible
      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');
      await expect(invitationSection).toBeVisible();
      await expect(invitationSection).toContainText('Invitation Status');

      // Step 4: Verify all required fields are displayed
      await expect(invitationSection).toContainText('Candidate Name');
      await expect(invitationSection).toContainText('Email');
      await expect(invitationSection).toContainText('Status');
      await expect(invitationSection).toContainText('Expires');
      await expect(invitationSection).toContainText('Last Accessed');
    });

    test('does not show invitation status section for orders without invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to order without invitation
      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-without-invitation');

      // Verify Invitation Status section is NOT visible
      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');
      await expect(invitationSection).not.toBeVisible();
    });

    test('invitation section appears between order info and status history', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to order with invitation
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-invitation');

      // Get the order details sidebar/panel
      const orderDetails = page.locator('[data-testid="order-details"], .order-details-sidebar');

      // Verify the sections appear in correct order
      const sections = orderDetails.locator('section, [data-testid$="-section"]');
      const sectionCount = await sections.count();

      // Find indices of each section
      let orderInfoIndex = -1;
      let invitationIndex = -1;
      let historyIndex = -1;

      for (let i = 0; i < sectionCount; i++) {
        const sectionText = await sections.nth(i).textContent();
        if (sectionText?.includes('Order #') || sectionText?.includes('Order Information')) {
          orderInfoIndex = i;
        } else if (sectionText?.includes('Invitation Status')) {
          invitationIndex = i;
        } else if (sectionText?.includes('Status History') || sectionText?.includes('Order History')) {
          historyIndex = i;
        }
      }

      // Verify invitation section is between order info and history
      expect(invitationIndex).toBeGreaterThan(orderInfoIndex);
      expect(invitationIndex).toBeLessThan(historyIndex);
    });
  });

  test.describe('Status Badge Display', () => {
    test('displays sent status with correct color and text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to order with sent invitation
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('Sent');

      // Verify blue color class (exact class will depend on implementation)
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/blue|primary/i);
    });

    test('displays opened status with correct color and text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-opened-invitation');

      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('Opened');

      // Verify yellow color class
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/yellow|warning/i);
    });

    test('displays in_progress status with correct color and text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-in-progress-invitation');

      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('In Progress');

      // Verify purple color class
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/purple|violet|indigo/i);
    });

    test('displays completed status with correct color and text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-completed-invitation');

      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('Completed');

      // Verify green color class
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/green|success/i);
    });

    test('displays expired status with correct color and text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('Expired');

      // Verify red color class
      const classes = await statusBadge.getAttribute('class');
      expect(classes).toMatch(/red|danger|error/i);
    });
  });

  test.describe('Extend Button Visibility Rules', () => {
    test('shows Extend button for sent status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await expect(extendButton).toBeVisible();
      await expect(extendButton).toBeEnabled();
    });

    test('shows Extend button for opened status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-opened-invitation');

      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await expect(extendButton).toBeVisible();
      await expect(extendButton).toBeEnabled();
    });

    test('shows Extend button for in_progress status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-in-progress-invitation');

      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await expect(extendButton).toBeVisible();
      await expect(extendButton).toBeEnabled();
    });

    test('shows Extend button for expired status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await expect(extendButton).toBeVisible();
      await expect(extendButton).toBeEnabled();
    });

    test('hides Extend button for completed status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-completed-invitation');

      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await expect(extendButton).not.toBeVisible();
    });
  });

  test.describe('Resend Button Visibility Rules', () => {
    test('shows Resend button for sent status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).toBeVisible();
      await expect(resendButton).toBeEnabled();
    });

    test('shows Resend button for opened status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-opened-invitation');

      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).toBeVisible();
      await expect(resendButton).toBeEnabled();
    });

    test('hides Resend button for in_progress status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-in-progress-invitation');

      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).not.toBeVisible();
    });

    test('hides Resend button for completed status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-completed-invitation');

      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).not.toBeVisible();
    });

    test('hides Resend button for expired status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).not.toBeVisible();
    });
  });

  test.describe('Extend Action Flow', () => {
    test('successfully extends invitation expiration with confirmation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to order with sent invitation
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Click Extend button
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      // Verify confirmation dialog appears
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText('Are you sure you want to extend the expiration date?');

      // Click confirm
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Verify loading state on button
      await expect(extendButton).toBeDisabled();
      await expect(extendButton).toContainText('Extending');

      // Verify success message appears
      await expect(page.locator('.toast, [role="status"]')).toContainText('Expiration date extended successfully');

      // Verify data refreshes (button is enabled again)
      await expect(extendButton).toBeEnabled();
      await expect(extendButton).toContainText('Extend');
    });

    test('can cancel extend action via confirmation dialog', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Click Extend button
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      // Click cancel in confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const cancelButton = confirmDialog.locator('button:has-text("Cancel"), button:has-text("No")');
      await cancelButton.click();

      // Verify dialog closes and no action taken
      await expect(confirmDialog).not.toBeVisible();
      await expect(page.locator('.toast, [role="status"]')).not.toBeVisible();

      // Button should still be enabled
      await expect(extendButton).toBeEnabled();
    });

    test('extending expired invitation reverts status to previous status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      // Verify status is expired
      const statusBadge = page.locator('[data-testid="invitation-status-badge"], .invitation-status-badge');
      await expect(statusBadge).toContainText('Expired');

      // Extend the invitation
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Wait for success
      await expect(page.locator('.toast, [role="status"]')).toContainText('Expiration date extended successfully');

      // Verify status reverted to previous (e.g., sent or opened)
      await expect(statusBadge).not.toContainText('Expired');

      // After extending expired, Resend button should become available if status is sent/opened
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).toBeVisible();
    });

    test('shows error when extend action fails', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Intercept API call to simulate failure
      await page.route('**/api/candidate/invitations/*/extend', route => {
        route.abort('failed');
      });

      // Try to extend
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Verify error message
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('Failed to extend expiration');

      // Button should be enabled again for retry
      await expect(extendButton).toBeEnabled();
    });
  });

  test.describe('Resend Action Flow', () => {
    test('successfully resends invitation with confirmation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Click Resend button
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await resendButton.click();

      // Verify confirmation dialog appears
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText('Are you sure you want to resend the invitation email?');

      // Click confirm
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Verify loading state on button
      await expect(resendButton).toBeDisabled();
      await expect(resendButton).toContainText('Resending');

      // Verify success message appears
      await expect(page.locator('.toast, [role="status"]')).toContainText('Invitation email resent successfully');

      // Verify button returns to normal state
      await expect(resendButton).toBeEnabled();
      await expect(resendButton).toContainText('Resend');
    });

    test('can cancel resend action via confirmation dialog', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Click Resend button
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await resendButton.click();

      // Click cancel in confirmation dialog
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const cancelButton = confirmDialog.locator('button:has-text("Cancel"), button:has-text("No")');
      await cancelButton.click();

      // Verify dialog closes and no action taken
      await expect(confirmDialog).not.toBeVisible();
      await expect(page.locator('.toast, [role="status"]')).not.toBeVisible();

      // Button should still be enabled
      await expect(resendButton).toBeEnabled();
    });

    test('shows error when resend action fails', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Intercept API call to simulate failure
      await page.route('**/api/candidate/invitations/*/resend', route => {
        route.abort('failed');
      });

      // Try to resend
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await resendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Verify error message
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('Failed to resend invitation');

      // Button should be enabled again for retry
      await expect(resendButton).toBeEnabled();
    });
  });

  test.describe('Permission-Based Button Visibility', () => {
    test('customer user with candidates.invite permission sees action buttons', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer with candidates.invite permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to customer portal order view
      await page.waitForURL(/\/dashboard|\/portal/);
      await page.goto('/portal/orders/order-with-invitation');

      // Verify action buttons are visible
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');

      await expect(extendButton).toBeVisible();
      await expect(resendButton).toBeVisible();
    });

    test('customer user without candidates.invite permission sees read-only view', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer WITHOUT candidates.invite permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to customer portal order view
      await page.waitForURL(/\/dashboard|\/portal/);
      await page.goto('/portal/orders/order-with-invitation');

      // Verify invitation status section is visible
      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');
      await expect(invitationSection).toBeVisible();
      await expect(invitationSection).toContainText('Invitation Status');

      // Verify action buttons are NOT visible
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');

      await expect(extendButton).not.toBeVisible();
      await expect(resendButton).not.toBeVisible();
    });

    test('internal/fulfillment users always see action buttons', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as internal user (no candidates.invite permission needed)
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Verify action buttons are visible
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');

      await expect(extendButton).toBeVisible();
      await expect(resendButton).toBeVisible();
    });
  });

  test.describe('Field Display Details', () => {
    test('displays candidate full name correctly', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-invitation');

      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');

      // Should display first and last name together
      await expect(invitationSection).toContainText('John Doe');
    });

    test('displays phone number with country code when provided', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-phone');

      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');

      // Should display phone with country code prefix
      await expect(invitationSection).toContainText('+1 5551234567');
    });

    test('omits phone field when not provided', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-without-phone');

      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');

      // Should not show Phone label at all when not provided
      await expect(invitationSection).not.toContainText('Phone');
    });

    test('displays "Not yet accessed" when lastAccessedAt is null', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');

      // Should show placeholder text for null lastAccessedAt
      await expect(invitationSection).toContainText('Not yet accessed');
    });

    test('displays actual date when lastAccessedAt has value', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-opened-invitation');

      const invitationSection = page.locator('[data-testid="invitation-status-section"], .invitation-status-section');

      // Should show actual date/time (not placeholder)
      await expect(invitationSection).not.toContainText('Not yet accessed');
      // Should contain date pattern (e.g., 2024, Apr, January, etc.)
      await expect(invitationSection.locator('text=/\\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/')).toBeVisible();
    });

    test('highlights expired date with visual indicator', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      // Find the expiration date element
      const expirationDate = page.locator('[data-testid="invitation-expiration-date"], .expiration-date');

      // Should have red/error styling
      const classes = await expirationDate.getAttribute('class');
      expect(classes).toMatch(/red|danger|error|expired/i);
    });
  });

  test.describe('Order Status History Integration', () => {
    test('displays invitation created event in status history', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-invitation');

      // Find status history section
      const statusHistory = page.locator('[data-testid="status-history"], .status-history');
      await expect(statusHistory).toBeVisible();

      // Should contain invitation created event
      await expect(statusHistory).toContainText('Invitation created');
    });

    test('displays invitation extended event after extend action', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Extend the invitation
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Wait for success
      await expect(page.locator('.toast, [role="status"]')).toContainText('Expiration date extended successfully');

      // Check status history for new event
      const statusHistory = page.locator('[data-testid="status-history"], .status-history');
      await expect(statusHistory).toContainText('Expiration extended');
    });

    test('displays invitation resent event after resend action', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Resend the invitation
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await resendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Wait for success
      await expect(page.locator('.toast, [role="status"]')).toContainText('Invitation email resent successfully');

      // Check status history for new event
      const statusHistory = page.locator('[data-testid="status-history"], .status-history');
      await expect(statusHistory).toContainText('Invitation resent');
    });

    test('invitation events are visually distinct from status changes', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-with-mixed-history');

      const statusHistory = page.locator('[data-testid="status-history"], .status-history');

      // Find a regular status change entry
      const statusChangeEntry = statusHistory.locator('.history-entry:has-text("draft → submitted")').first();

      // Find an invitation event entry
      const invitationEventEntry = statusHistory.locator('.history-entry:has-text("Invitation created")').first();

      // Get classes or visual indicators
      const statusChangeClasses = await statusChangeEntry.getAttribute('class');
      const invitationEventClasses = await invitationEventEntry.getAttribute('class');

      // Should have different styling
      expect(statusChangeClasses).not.toBe(invitationEventClasses);

      // Invitation events might have special icon or label
      const invitationIcon = invitationEventEntry.locator('[data-testid="event-icon"], .event-icon');
      await expect(invitationIcon).toBeVisible();
    });
  });

  test.describe('Loading States and Double-Click Prevention', () => {
    test('disables Extend button during action processing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Slow down the API response to observe loading state
      await page.route('**/api/candidate/invitations/*/extend', async route => {
        await page.waitForTimeout(1000); // Delay for 1 second
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Click Extend button
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      // Confirm action
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Button should be disabled immediately
      await expect(extendButton).toBeDisabled();

      // Try to click again (should not trigger another request)
      await extendButton.click({ force: true });

      // Still disabled
      await expect(extendButton).toBeDisabled();
    });

    test('disables Resend button during action processing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-sent-invitation');

      // Slow down the API response to observe loading state
      await page.route('**/api/candidate/invitations/*/resend', async route => {
        await page.waitForTimeout(1000); // Delay for 1 second
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      // Click Resend button
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await resendButton.click();

      // Confirm action
      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Button should be disabled immediately
      await expect(resendButton).toBeDisabled();

      // Try to click again (should not trigger another request)
      await resendButton.click({ force: true });

      // Still disabled
      await expect(resendButton).toBeDisabled();
    });
  });

  test.describe('Two-Step Flow for Expired Invitations', () => {
    test('requires extend before resend for expired invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/fulfillment|\/dashboard/);
      await page.goto('/fulfillment/orders/order-expired-invitation');

      // Step 1: Verify Resend is not available when expired
      const resendButton = page.locator('button:has-text("Resend"), [data-testid="resend-invitation-button"]');
      await expect(resendButton).not.toBeVisible();

      // Step 2: Extend the invitation
      const extendButton = page.locator('button:has-text("Extend"), [data-testid="extend-invitation-button"]');
      await extendButton.click();

      const confirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await confirmButton.click();

      // Wait for success
      await expect(page.locator('.toast, [role="status"]')).toContainText('Expiration date extended successfully');

      // Step 3: Verify Resend is now available
      await expect(resendButton).toBeVisible();
      await expect(resendButton).toBeEnabled();

      // Step 4: Can now resend if desired
      await resendButton.click();

      const resendConfirmDialog = page.locator('[role="dialog"], [data-testid="confirm-dialog"]');
      const resendConfirmButton = resendConfirmDialog.locator('button:has-text("Confirm"), button:has-text("Yes")');
      await resendConfirmButton.click();

      await expect(page.locator('.toast, [role="status"]')).toContainText('Invitation email resent successfully');
    });
  });
});