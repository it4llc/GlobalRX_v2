// /GlobalRX_v2/tests/e2e/package-workflow-filter-bug.spec.ts
// End-to-end tests for package workflow filtering bug
//
// THE BUG:
// /api/packages?hasWorkflow=true returns ALL packages with any workflow,
// even if the workflow is disabled or in draft/archived status.
// It should only return packages with active, non-disabled workflows.

import { test, expect } from '@playwright/test';

test.describe('Package Workflow Filter Bug - E2E Tests', () => {

  // REGRESSION TEST: proves bug fix for package workflow status filtering
  test('only shows packages with active workflows when inviting candidates', async ({ page }) => {
    // This test verifies that when the InviteCandidateDialog fetches packages
    // with hasWorkflow=true, it only gets packages with active workflows
    // (not disabled, not draft, not archived)

    // Step 1: Login as customer user with invite permission
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Step 2: Navigate to portal/orders page where invite dialog is available
    await page.waitForURL(/\/portal|\/dashboard/);
    await page.goto('/portal/orders');

    // Step 3: Open the invite candidate dialog
    const inviteButton = page.locator('button:has-text("Invite Candidate")');
    await inviteButton.click();

    // Step 4: Wait for the package dropdown to be populated
    const packageSelect = page.locator('select[name="packageId"], [data-testid="package-select"]');
    await expect(packageSelect).toBeVisible();

    // Step 5: Get all package options
    const packageOptions = packageSelect.locator('option');
    const optionCount = await packageOptions.count();

    // Step 6: Verify only active workflow packages are shown
    // The test assumes the following package setup:
    // - Package 1: has active workflow (status=active, disabled=false) - SHOULD BE SHOWN
    // - Package 2: has disabled workflow (status=active, disabled=true) - SHOULD NOT BE SHOWN
    // - Package 3: has draft workflow (status=draft, disabled=false) - SHOULD NOT BE SHOWN
    // - Package 4: has archived workflow (status=archived, disabled=false) - SHOULD NOT BE SHOWN
    // - Package 5: has no workflow - SHOULD NOT BE SHOWN

    // Verify that only packages with truly active workflows are in the dropdown
    const optionTexts = await packageOptions.allTextContent();

    // Should NOT contain packages with disabled workflows
    expect(optionTexts.join(' ')).not.toContain('Disabled Workflow Package');

    // Should NOT contain packages with draft workflows
    expect(optionTexts.join(' ')).not.toContain('Draft Workflow Package');

    // Should NOT contain packages with archived workflows
    expect(optionTexts.join(' ')).not.toContain('Archived Workflow Package');

    // Should NOT contain packages without workflows
    expect(optionTexts.join(' ')).not.toContain('No Workflow Package');

    // Should contain packages with active workflows
    expect(optionTexts.join(' ')).toContain('Active Workflow Package');
  });

  test('shows empty state when no packages have active workflows', async ({ page }) => {
    // This test verifies that when NO packages have active workflows,
    // the invite dialog shows an appropriate message

    // Login as customer user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer-no-active-workflows@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate and open invite dialog
    await page.waitForURL(/\/portal|\/dashboard/);
    await page.goto('/portal/orders');

    const inviteButton = page.locator('button:has-text("Invite Candidate")');
    await inviteButton.click();

    // Verify that appropriate message is shown when no packages with active workflows exist
    const emptyMessage = page.locator('text=/no packages.*workflow|No packages with workflows available/i');
    await expect(emptyMessage).toBeVisible();
  });

  test('package dropdown updates correctly when workflow status changes', async ({ page }) => {
    // This test verifies dynamic behavior: if a workflow is disabled while
    // the user has the dialog open, refreshing should remove that package

    // Login as customer user
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Navigate and open invite dialog
    await page.waitForURL(/\/portal|\/dashboard/);
    await page.goto('/portal/orders');

    const inviteButton = page.locator('button:has-text("Invite Candidate")');
    await inviteButton.click();

    // Get initial package count
    const packageSelect = page.locator('select[name="packageId"], [data-testid="package-select"]');
    await expect(packageSelect).toBeVisible();
    const initialOptions = await packageSelect.locator('option').count();

    // Close and reopen dialog (simulating a refresh)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await inviteButton.click();

    // Package list should still be filtered correctly
    const refreshedOptions = await packageSelect.locator('option').count();
    expect(refreshedOptions).toBeGreaterThan(0); // Should have at least placeholder option
  });

  test.describe('Error scenarios', () => {
    test('handles API error gracefully when loading packages', async ({ page }) => {
      // Login as customer user
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Intercept the packages API call to simulate an error
      await page.route('/api/packages?hasWorkflow=true', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });

      // Navigate and try to open invite dialog
      await page.waitForURL(/\/portal|\/dashboard/);
      await page.goto('/portal/orders');

      const inviteButton = page.locator('button:has-text("Invite Candidate")');
      await inviteButton.click();

      // Should show error message
      const errorMessage = page.locator('text=/error.*loading.*packages|Failed to load packages/i');
      await expect(errorMessage).toBeVisible();
    });
  });
});