// /GlobalRX_v2/tests/e2e/create-invite-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create Invite Flow - E2E Tests', () => {

  test.describe('Button Visibility and Permissions', () => {
    test('shows Invite Candidate button for users with candidates.invite permission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Login as customer user with candidates.invite permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to customer dashboard
      await page.waitForURL(/\/dashboard|\/portal/);

      // Step 3: Verify Invite Candidate button is visible in main action area
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await expect(inviteButton).toBeVisible();
    });

    test('hides Invite Candidate button for users without candidates.invite permission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer user WITHOUT candidates.invite permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Navigate to customer dashboard
      await page.waitForURL(/\/dashboard|\/portal/);

      // Verify Invite Candidate button is NOT visible
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await expect(inviteButton).not.toBeVisible();
    });
  });

  test.describe('Package Selection Step', () => {
    test('shows only packages with active workflows in the selection list', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to dashboard
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Click Invite Candidate button
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      // Verify dialog opens with Step 1: Select Package
      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Step 1');
      await expect(dialog).toContainText('Select Package');

      // Verify package list shows packages with workflows
      const packageList = dialog.locator('[data-testid="package-list"], .package-list');
      await expect(packageList).toBeVisible();

      // Each package should show name and description
      const packageItems = packageList.locator('[data-testid^="package-item"], .package-item');
      const packageCount = await packageItems.count();
      expect(packageCount).toBeGreaterThan(0);

      // Check first package has name and description
      const firstPackage = packageItems.first();
      await expect(firstPackage.locator('.package-name, [data-testid="package-name"]')).toBeVisible();
      await expect(firstPackage.locator('.package-description, [data-testid="package-description"]')).toBeVisible();
    });

    test('shows empty state when no packages have workflows', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login as customer with no workflow packages
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-workflows@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Click Invite Candidate button
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      // Verify empty state message
      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('No packages available. Please contact your administrator to set up packages with workflows.');
    });

    test('advances to candidate information step after package selection', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and open dialog
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');

      // Select first package
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();

      // Click Next button
      const nextButton = dialog.locator('button:has-text("Next")');
      await nextButton.click();

      // Verify Step 2 is shown
      await expect(dialog).toContainText('Step 2');
      await expect(dialog).toContainText('Candidate Information');
    });
  });

  test.describe('Candidate Information Step', () => {
    test('shows all required and optional fields with correct defaults', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Verify all fields are present
      await expect(dialog.locator('input[name="firstName"], [data-testid="firstName"]')).toBeVisible();
      await expect(dialog.locator('input[name="lastName"], [data-testid="lastName"]')).toBeVisible();
      await expect(dialog.locator('input[name="email"], [data-testid="email"]')).toBeVisible();
      await expect(dialog.locator('select[name="phoneCountryCode"], [data-testid="phoneCountryCode"]')).toBeVisible();
      await expect(dialog.locator('input[name="phoneNumber"], [data-testid="phoneNumber"]')).toBeVisible();

      // Verify required field indicators (usually * or aria-required)
      const firstNameField = dialog.locator('input[name="firstName"], [data-testid="firstName"]');
      const lastNameField = dialog.locator('input[name="lastName"], [data-testid="lastName"]');
      const emailField = dialog.locator('input[name="email"], [data-testid="email"]');

      await expect(firstNameField).toHaveAttribute('required', '');
      await expect(lastNameField).toHaveAttribute('required', '');
      await expect(emailField).toHaveAttribute('required', '');

      // Verify phone country code defaults to +1
      const phoneCountryCode = dialog.locator('select[name="phoneCountryCode"], [data-testid="phoneCountryCode"]');
      await expect(phoneCountryCode).toHaveValue('+1');
    });

    test('validates email format inline', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Enter invalid email
      const emailField = dialog.locator('input[name="email"], [data-testid="email"]');
      await emailField.fill('invalid-email');
      await emailField.blur();

      // Verify error message appears
      const emailError = dialog.locator('[data-testid="email-error"], .field-error');
      await expect(emailError).toBeVisible();
      await expect(emailError).toContainText('Please enter a valid email address');
    });

    test('validates required fields before submission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Try to submit without filling required fields
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Verify error messages for required fields
      await expect(dialog.locator('[data-testid="firstName-error"], .field-error')).toBeVisible();
      await expect(dialog.locator('[data-testid="lastName-error"], .field-error')).toBeVisible();
      await expect(dialog.locator('[data-testid="email-error"], .field-error')).toBeVisible();
    });

    test('allows submission with optional phone fields empty', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Fill only required fields
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('John');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Doe');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('john.doe@example.com');

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Should proceed to success (loading state first)
      await expect(createButton).toBeDisabled();
    });
  });

  test.describe('Complete Flow with Success', () => {
    test('creates invitation and shows success screen with copyable link', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Open dialog
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');

      // Step 1: Select package
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Step 2: Fill candidate information
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('John');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Doe');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('john.doe@example.com');
      await dialog.locator('select[name="phoneCountryCode"], [data-testid="phoneCountryCode"]').selectOption('+1');
      await dialog.locator('input[name="phoneNumber"], [data-testid="phoneNumber"]').fill('555-1234567');

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Verify loading state
      await expect(createButton).toBeDisabled();
      await expect(createButton).toContainText('Creating');

      // Wait for success screen
      await expect(dialog).toContainText('Invitation Created Successfully');
      await expect(dialog).toContainText('Invitation sent to John Doe at john.doe@example.com');
      await expect(dialog).toContainText('This invitation expires on');

      // Verify invitation link is displayed
      const invitationLink = dialog.locator('input[readonly], [data-testid="invitation-link"]');
      await expect(invitationLink).toBeVisible();
      const linkValue = await invitationLink.inputValue();
      expect(linkValue).toMatch(/\/invite\/[A-Za-z0-9_-]+/);

      // Verify Copy Link button
      const copyButton = dialog.locator('button:has-text("Copy Link"), [data-testid="copy-link-button"]');
      await expect(copyButton).toBeVisible();

      // Click Copy Link
      await copyButton.click();

      // Verify toast notification
      await expect(page.locator('.toast, [role="status"]')).toContainText('Link copied to clipboard');

      // Close dialog
      const doneButton = dialog.locator('button:has-text("Done")');
      await doneButton.click();

      // Verify dialog is closed
      await expect(dialog).not.toBeVisible();
    });

    test('handles special characters in candidate names', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Open dialog and navigate to Step 2
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Enter names with special characters
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill("Jean-François");
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill("O'Connor-Smith");
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('jean.francois@example.com');

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Verify success with special characters preserved
      await expect(dialog).toContainText('Invitation Created Successfully');
      await expect(dialog).toContainText("Jean-François O'Connor-Smith");
    });

    test('handles uppercase email by sending as-is to API', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Open dialog and navigate to Step 2
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Enter email with uppercase
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('Jane');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Smith');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('Jane.SMITH@EXAMPLE.COM');

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Success should show normalized email (API handles normalization)
      await expect(dialog).toContainText('Invitation Created Successfully');
    });
  });

  test.describe('Error Handling', () => {
    test('shows error toast when network fails during submission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Fill form
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('John');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Doe');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('john.doe@example.com');

      // Intercept API call to simulate network failure
      await page.route('**/api/candidate/invitations', route => {
        route.abort('failed');
      });

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Verify error toast
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('Unable to create invitation. Please check your connection and try again.');

      // Form should become editable again
      await expect(createButton).toBeEnabled();
      await expect(createButton).toContainText('Create Invitation');
    });

    test('shows error when package has no workflow configured', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login and navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Fill form
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('John');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Doe');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('john.doe@example.com');

      // Intercept API call to return 422
      await page.route('**/api/candidate/invitations', route => {
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'This package does not have a workflow configured. Please contact your administrator.' })
        });
      });

      // Submit
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();

      // Verify error toast
      await expect(page.locator('.toast.error, [role="alert"]')).toContainText('This package does not have a workflow configured. Please contact your administrator.');
    });

    test('shows error when user lacks permission', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Simulate direct navigation to dialog URL without permission
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer-no-invite@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Try to access invite flow via direct manipulation (if button is hidden)
      // This tests API-level permission check
      const response = await page.request.post('/api/candidate/invitations', {
        data: {
          packageId: 'test-package-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        }
      });

      expect(response.status()).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("You don't have permission to create invitations");
    });
  });

  test.describe('Dialog Navigation', () => {
    test('can go back from Step 2 to Step 1', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Verify on Step 2
      await expect(dialog).toContainText('Step 2');

      // Click Back button
      const backButton = dialog.locator('button:has-text("Back")');
      await backButton.click();

      // Verify back on Step 1
      await expect(dialog).toContainText('Step 1');
      await expect(dialog).toContainText('Select Package');
    });

    test('can cancel dialog at any step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Open dialog
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      await expect(dialog).toBeVisible();

      // Click Cancel or X button
      const cancelButton = dialog.locator('button:has-text("Cancel"), [aria-label="Close"]').first();
      await cancelButton.click();

      // Verify dialog closed
      await expect(dialog).not.toBeVisible();
    });

    test('prevents double submission with rapid clicking', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Navigate to Step 2
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      const firstPackage = dialog.locator('[data-testid^="package-item"], .package-item').first();
      await firstPackage.click();
      await dialog.locator('button:has-text("Next")').click();

      // Fill form
      await dialog.locator('input[name="firstName"], [data-testid="firstName"]').fill('John');
      await dialog.locator('input[name="lastName"], [data-testid="lastName"]').fill('Doe');
      await dialog.locator('input[name="email"], [data-testid="email"]').fill('john.doe@example.com');

      // Rapidly click submit multiple times
      const createButton = dialog.locator('button:has-text("Create Invitation")');
      await createButton.click();
      await createButton.click();
      await createButton.click();

      // Button should be disabled after first click
      await expect(createButton).toBeDisabled();

      // Only one request should be made (verified by success appearing once)
      await expect(dialog).toContainText('Invitation Created Successfully');
      const successMessages = dialog.locator('text="Invitation Created Successfully"');
      await expect(successMessages).toHaveCount(1);
    });
  });

  test.describe('Package API Integration', () => {
    test('fetches packages with workflow filter from GET /api/packages', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard|\/portal/);

      // Intercept the packages API call to verify it's made
      let packagesCalled = false;
      await page.route('**/api/packages?*', route => {
        packagesCalled = true;
        const url = new URL(route.request().url());
        // Verify hasWorkflow parameter is sent
        expect(url.searchParams.get('hasWorkflow')).toBe('true');

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'package-1',
              name: 'Basic Screening',
              description: 'Standard background check package'
            },
            {
              id: 'package-2',
              name: 'Enhanced Screening',
              description: 'Comprehensive background check with additional verifications'
            }
          ])
        });
      });

      // Click Invite Candidate button
      const inviteButton = page.locator('button:has-text("Invite Candidate"), [data-testid="invite-candidate-button"]');
      await inviteButton.click();

      // Verify API was called
      expect(packagesCalled).toBe(true);

      // Verify packages are displayed
      const dialog = page.locator('[role="dialog"], [data-testid="invite-candidate-dialog"]');
      await expect(dialog).toContainText('Basic Screening');
      await expect(dialog).toContainText('Standard background check package');
      await expect(dialog).toContainText('Enhanced Screening');
      await expect(dialog).toContainText('Comprehensive background check with additional verifications');
    });
  });
});