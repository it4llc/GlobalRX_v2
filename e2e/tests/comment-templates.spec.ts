// /GlobalRX_v2/e2e/tests/comment-templates.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CommentTemplatesPage } from '../pages/CommentTemplatesPage';

test.describe('Comment Template Management', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as internal admin user with comment_management permission
    await loginPage.goto();
    await loginPage.login('admin@globalrx.com', 'adminpass123');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Navigation and Access', () => {
    test('user with comment_management permission can access templates', async ({ page }) => {
      // Switch to configuration view
      await page.getByRole('button', { name: /configuration view/i }).click();

      // Navigate to comment templates
      await page.getByRole('link', { name: /comment templates/i }).click();

      // Should reach the comment templates page
      await expect(page).toHaveURL(/\/comment-templates/);
      await expect(page.getByRole('heading', { name: /comment templates/i })).toBeVisible();
    });

    test('user without comment_management permission sees forbidden', async ({ page }) => {
      // Logout and login as user without permission
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('user@globalrx.com', 'userpass');
      await page.waitForURL('**/dashboard');

      // Try to navigate directly
      await page.goto('/comment-templates');

      // Should show forbidden or redirect
      await expect(page.getByText(/forbidden|not authorized/i)).toBeVisible();
    });

    test('vendor users cannot access comment templates', async ({ page }) => {
      // Logout and login as vendor user
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendor@service.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // Try to navigate directly
      await page.goto('/comment-templates');

      // Should show forbidden or redirect
      await expect(page).toHaveURL(/\/(dashboard|forbidden|login)/);
    });

    test('customer users cannot access comment templates', async ({ page }) => {
      // Logout and login as customer user
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('customer@company.com', 'customerpass');
      await page.waitForURL('**/dashboard');

      // Try to navigate directly
      await page.goto('/comment-templates');

      // Should show forbidden or redirect
      await expect(page).toHaveURL(/\/(dashboard|forbidden|login)/);
    });
  });

  test.describe('Grid Display', () => {
    test.beforeEach(async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();
    });

    test('should display grid with services as rows and statuses as columns', async ({ page }) => {
      // Check column headers (statuses)
      const statusColumns = ['PASS', 'FAIL', 'PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
      for (const status of statusColumns) {
        await expect(page.getByRole('columnheader', { name: status })).toBeVisible();
      }

      // Check row headers (services) - at minimum these should exist
      await expect(page.getByRole('rowheader', { name: /motor vehicle/i })).toBeVisible();
      await expect(page.getByRole('rowheader', { name: /criminal/i })).toBeVisible();
      await expect(page.getByRole('rowheader', { name: /drug/i })).toBeVisible();
    });

    test('should show existing templates in correct cells', async ({ page }) => {
      // Look for any existing templates in the grid
      const cells = page.locator('[data-testid^="cell-"]');
      const cellCount = await cells.count();

      // At least some cells should have templates
      let templatesFound = false;
      for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        const hasTemplate = await cell.locator('button:not(:has-text("Add template"))').count() > 0;
        if (hasTemplate) {
          templatesFound = true;
          break;
        }
      }

      if (!templatesFound) {
        // If no templates, all cells should show "Add template"
        await expect(page.getByRole('button', { name: /add template/i }).first()).toBeVisible();
      }
    });

    test('should indicate templates that have been used', async ({ page }) => {
      // Create a template and mark it as used (would need to be used in an order)
      // Then check for the used indicator

      // Look for any templates with used indicator
      const usedIndicators = page.locator('[data-testid="used-indicator"]');
      const count = await usedIndicators.count();

      if (count > 0) {
        // Verify the indicator shows proper tooltip
        await usedIndicators.first().hover();
        await expect(page.getByRole('tooltip', { name: /has been used/i })).toBeVisible();
      }
    });
  });

  test.describe('Template CRUD Operations', () => {
    test('should create a new comment template', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Find an empty cell (e.g., Drug Screening - PASS)
      const drugRow = page.locator('tr').filter({ hasText: /drug screening/i });
      const passCell = drugRow.locator('[data-testid="cell-DRUG-PASS"]');

      // Click add template
      await passCell.getByRole('button', { name: /add template/i }).click();

      // Fill in the template form
      const dialog = page.getByRole('dialog', { name: /create template/i });
      await expect(dialog).toBeVisible();

      // Service and status should be pre-filled
      await expect(dialog.getByText('DRUG')).toBeVisible();
      await expect(dialog.getByText('PASS')).toBeVisible();

      // Enter template text with placeholders
      const templateText = 'Drug screening passed for [candidateName] on [testDate]';
      await dialog.getByLabel(/template text/i).fill(templateText);

      // Check character count
      await expect(dialog.getByText(/\d+\/1000/)).toBeVisible();

      // Save
      await dialog.getByRole('button', { name: /save/i }).click();

      // Verify success message
      await expect(page.getByText(/template created successfully/i)).toBeVisible();

      // Verify template appears in grid
      await expect(passCell.getByText(templateText)).toBeVisible();
    });

    test('should validate template requirements', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Open create dialog
      const emptyCell = page.locator('[data-testid^="cell-"]')
        .filter({ hasText: /add template/i })
        .first();
      await emptyCell.getByRole('button', { name: /add template/i }).click();

      const dialog = page.getByRole('dialog', { name: /create template/i });

      // Try to save without entering template
      await dialog.getByRole('button', { name: /save/i }).click();

      // Should show validation error
      await expect(dialog.getByText(/template is required/i)).toBeVisible();

      // Enter template exceeding 1000 characters
      const longTemplate = 'A'.repeat(1001);
      const textarea = dialog.getByLabel(/template text/i);
      await textarea.fill(longTemplate);

      // Should show character limit exceeded
      await expect(dialog.getByText('1001/1000')).toBeVisible();
      await expect(dialog.getByRole('button', { name: /save/i })).toBeDisabled();

      // Clear and enter valid template
      await textarea.clear();
      await textarea.fill('Valid template with [placeholder]');

      // Should be able to save now
      await expect(dialog.getByRole('button', { name: /save/i })).toBeEnabled();
    });

    test('should edit existing template', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Find a cell with an existing template
      const templateButton = page.locator('[data-testid^="cell-"]')
        .locator('button:not(:has-text("Add template"))')
        .first();

      // Get original text
      const originalText = await templateButton.textContent();

      // Click to edit
      await templateButton.click();

      // Edit dialog should open
      const dialog = page.getByRole('dialog', { name: /edit template/i });
      await expect(dialog).toBeVisible();

      // Service and status should be disabled for existing templates
      const serviceField = dialog.getByLabel(/service/i);
      const statusField = dialog.getByLabel(/status/i);
      await expect(serviceField).toBeDisabled();
      await expect(statusField).toBeDisabled();

      // Update the template text
      const textarea = dialog.getByLabel(/template text/i);
      await textarea.clear();
      const updatedText = 'Updated template for [candidateName] with [additionalInfo]';
      await textarea.fill(updatedText);

      // Save changes
      await dialog.getByRole('button', { name: /save/i }).click();

      // Verify success message
      await expect(page.getByText(/template updated successfully/i)).toBeVisible();

      // Verify template updated in grid
      await expect(page.getByText(updatedText)).toBeVisible();
      await expect(page.getByText(originalText || '')).not.toBeVisible();
    });

    test('should delete unused template', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // First create a new template to ensure we have one to delete
      const emptyCell = page.locator('[data-testid^="cell-"]')
        .filter({ hasText: /add template/i })
        .first();
      await emptyCell.getByRole('button', { name: /add template/i }).click();

      const createDialog = page.getByRole('dialog', { name: /create template/i });
      const templateText = 'Template to be deleted';
      await createDialog.getByLabel(/template text/i).fill(templateText);
      await createDialog.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText(/template created successfully/i)).toBeVisible();

      // Now delete it
      await page.getByText(templateText).click();

      const editDialog = page.getByRole('dialog', { name: /edit template/i });
      await editDialog.getByRole('button', { name: /delete/i }).click();

      // Confirm deletion
      const confirmDialog = page.getByRole('dialog', { name: /confirm delete/i });
      await expect(confirmDialog.getByText(/are you sure/i)).toBeVisible();
      await expect(confirmDialog.getByText(/cannot be undone/i)).toBeVisible();

      await confirmDialog.getByRole('button', { name: /confirm|delete/i }).click();

      // Verify success message
      await expect(page.getByText(/template deleted successfully/i)).toBeVisible();

      // Verify template removed from grid
      await expect(page.getByText(templateText)).not.toBeVisible();
    });

    test('should archive used template instead of deleting', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Find a template with the used indicator
      const usedTemplate = page.locator('[data-testid^="cell-"]')
        .filter({ has: page.locator('[data-testid="used-indicator"]') })
        .locator('button')
        .first();

      if (await usedTemplate.count() > 0) {
        const templateText = await usedTemplate.textContent();

        // Click to edit
        await usedTemplate.click();

        const editDialog = page.getByRole('dialog', { name: /edit template/i });
        await editDialog.getByRole('button', { name: /delete/i }).click();

        // Should show archive confirmation instead of delete
        const confirmDialog = page.getByRole('dialog');
        await expect(confirmDialog.getByText(/has been used/i)).toBeVisible();
        await expect(confirmDialog.getByText(/will be archived/i)).toBeVisible();

        await confirmDialog.getByRole('button', { name: /confirm|archive/i }).click();

        // Verify success message
        await expect(page.getByText(/template archived successfully/i)).toBeVisible();

        // Template should no longer be visible in grid (soft deleted)
        await expect(page.getByText(templateText || '')).not.toBeVisible();
      }
    });

    test('should not allow duplicate templates', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Get an existing template's details
      const existingTemplate = page.locator('[data-testid^="cell-"]')
        .locator('button:not(:has-text("Add template"))')
        .first();

      if (await existingTemplate.count() > 0) {
        // Click to view details
        await existingTemplate.click();

        const editDialog = page.getByRole('dialog', { name: /edit template/i });

        // Get the service code, status, and template text
        const templateText = await editDialog.getByLabel(/template text/i).inputValue();
        const serviceCode = await editDialog.getByLabel(/service/i).inputValue();
        const status = await editDialog.getByLabel(/status/i).inputValue();

        // Close dialog
        await editDialog.getByRole('button', { name: /cancel/i }).click();

        // Try to create duplicate in same cell
        const targetCell = page.locator(`[data-testid="cell-${serviceCode}-${status}"]`);

        // This should not have an add button since template exists
        await expect(targetCell.getByRole('button', { name: /add template/i })).not.toBeVisible();
      }
    });
  });

  test.describe('Placeholder Functionality', () => {
    test('should show placeholder helper text', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Open create dialog
      const emptyCell = page.locator('[data-testid^="cell-"]')
        .filter({ hasText: /add template/i })
        .first();
      await emptyCell.getByRole('button', { name: /add template/i }).click();

      const dialog = page.getByRole('dialog', { name: /create template/i });

      // Should show helper text about placeholders
      await expect(dialog.getByText(/use \[placeholder\] syntax/i)).toBeVisible();

      // May show examples
      await expect(dialog.getByText(/\[candidateName\]/)).toBeVisible();
    });

    test('should highlight placeholders in preview', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Create template with placeholders
      const emptyCell = page.locator('[data-testid^="cell-"]')
        .filter({ hasText: /add template/i })
        .first();
      await emptyCell.getByRole('button', { name: /add template/i }).click();

      const dialog = page.getByRole('dialog', { name: /create template/i });
      const templateWithPlaceholders = 'Check completed for [candidateName] on [date] by [reviewerName]';
      await dialog.getByLabel(/template text/i).fill(templateWithPlaceholders);

      // Placeholders might be highlighted in preview
      const preview = dialog.locator('[data-testid="template-preview"]');
      if (await preview.count() > 0) {
        const highlightedPlaceholders = preview.locator('.placeholder-highlight');
        await expect(highlightedPlaceholders).toHaveCount(3);
      }
    });
  });

  test.describe('Grid Interactions', () => {
    test('should show full template on hover', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Find a template that might be truncated
      const templateButton = page.locator('[data-testid^="cell-"]')
        .locator('button:not(:has-text("Add template"))')
        .first();

      if (await templateButton.count() > 0) {
        // Hover over template
        await templateButton.hover();

        // Tooltip should show full template text
        await expect(page.getByRole('tooltip')).toBeVisible();
      }
    });

    test('should highlight row on hover', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Get a service row
      const serviceRow = page.locator('tr').filter({ hasText: /motor vehicle/i });

      // Hover over row
      await serviceRow.hover();

      // Row should have hover styling
      const rowClasses = await serviceRow.getAttribute('class');
      expect(rowClasses).toContain('hover');
    });

    test('should allow keyboard navigation', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Focus first interactive element
      await page.keyboard.press('Tab');

      // Should be able to navigate with arrow keys
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');

      // Enter should open edit/create dialog
      await page.keyboard.press('Enter');

      // Dialog should be open
      await expect(page.getByRole('dialog')).toBeVisible();

      // Escape should close dialog
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Filtering and Search', () => {
    test('should filter templates by service', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Look for service filter
      const serviceFilter = page.getByLabel(/filter by service/i);
      if (await serviceFilter.count() > 0) {
        await serviceFilter.selectOption('MVR');

        // Grid should only show MVR row
        await expect(page.getByRole('rowheader', { name: /motor vehicle/i })).toBeVisible();
        await expect(page.getByRole('rowheader', { name: /criminal/i })).not.toBeVisible();
      }
    });

    test('should filter templates by status', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Look for status filter
      const statusFilter = page.getByLabel(/filter by status/i);
      if (await statusFilter.count() > 0) {
        await statusFilter.selectOption('PASS');

        // Grid should only show PASS column
        await expect(page.getByRole('columnheader', { name: 'PASS' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'FAIL' })).not.toBeVisible();
      }
    });

    test('should search templates by text', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Look for search input
      const searchInput = page.getByPlaceholder(/search templates/i);
      if (await searchInput.count() > 0) {
        await searchInput.fill('candidate');

        // Should only show templates containing "candidate"
        const visibleTemplates = page.locator('[data-testid^="cell-"]')
          .locator('button:not(:has-text("Add template"))');

        const count = await visibleTemplates.count();
        for (let i = 0; i < count; i++) {
          const text = await visibleTemplates.nth(i).textContent();
          expect(text?.toLowerCase()).toContain('candidate');
        }
      }
    });
  });

  test.describe('Bulk Operations', () => {
    test('should allow bulk export of templates', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Look for export button
      const exportButton = page.getByRole('button', { name: /export/i });
      if (await exportButton.count() > 0) {
        // Start waiting for download before clicking
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();

        // Wait for download and verify
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('templates');
        expect(download.suggestedFilename()).toMatch(/\.(csv|json|xlsx)$/);
      }
    });

    test('should allow bulk import of templates', async ({ page }) => {
      const templatesPage = new CommentTemplatesPage(page);
      await templatesPage.goto();

      // Look for import button
      const importButton = page.getByRole('button', { name: /import/i });
      if (await importButton.count() > 0) {
        await importButton.click();

        // Import dialog should open
        const dialog = page.getByRole('dialog', { name: /import templates/i });
        await expect(dialog).toBeVisible();

        // Should show file input
        await expect(dialog.getByLabel(/choose file/i)).toBeVisible();

        // Should show format requirements
        await expect(dialog.getByText(/csv|json|format/i)).toBeVisible();
      }
    });
  });
});