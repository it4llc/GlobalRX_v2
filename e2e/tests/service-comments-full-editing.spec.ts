// /GlobalRX_v2/e2e/tests/service-comments-full-editing.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Service Comments - Full Text Editing Feature', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as user with fulfillment permission
    await loginPage.goto();
    await loginPage.login('admin@globalrx.com', 'adminpass123');
    await page.waitForURL('**/dashboard');
  });

  test.describe('Template Text as Editable Starting Point', () => {
    test('user selects template and sees full text in editable textarea', async ({ page }) => {
      // Navigate to orders
      await page.getByRole('link', { name: /orders/i }).click();

      // Open an order with services
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();

      // Wait for order details page
      await expect(page.getByText(/order details/i)).toBeVisible();

      // Click on a service tab
      await page.getByRole('tab', { name: /background check/i }).click();

      // Click Add Comment button
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select a template from dropdown
      await page.getByLabel(/template/i).selectOption({ label: 'Document Required' });

      // Template text should appear in an editable textarea (not read-only preview)
      const textarea = page.getByRole('textbox', { name: /comment text/i });
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeEditable();
      await expect(textarea).not.toHaveAttribute('readonly');

      // Template text should include brackets as regular text
      const textContent = await textarea.inputValue();
      expect(textContent).toContain('[');
      expect(textContent).toContain(']');

      // Should NOT have separate placeholder input fields
      await expect(page.getByLabel(/document type/i)).not.toBeVisible();
      await expect(page.getByTestId('placeholder-input')).not.toBeVisible();
    });

    test('user can modify any part of template text freely', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Clear template text and enter completely new text
      await textarea.clear();
      await textarea.fill('Completely different text that has nothing to do with the template');

      // Character count should update
      await expect(page.getByText(/67\/1000 characters/i)).toBeVisible();

      // Save the comment
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear with the modified text
      await expect(page.getByText('Completely different text that has nothing to do with the template')).toBeVisible();
    });

    test('user can keep brackets in text without error', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Modify text but keep some brackets
      await textarea.clear();
      await textarea.fill('Please provide [driver license] by [tomorrow] for verification');

      // No validation error should appear for brackets
      await expect(page.getByText(/placeholders must be replaced/i)).not.toBeVisible();

      // Save should work
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear with brackets intact
      await expect(page.getByText('Please provide [driver license] by [tomorrow] for verification')).toBeVisible();
    });

    test('user can remove all brackets from template text', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select template with brackets
      await page.getByLabel(/template/i).selectOption({ label: 'Document Required' });

      const textarea = page.getByRole('textbox', { name: /comment text/i });
      const originalText = await textarea.inputValue();
      expect(originalText).toContain('[');

      // Replace brackets with actual values
      await textarea.clear();
      await textarea.fill('Please provide driver license by end of day for verification purposes.');

      // No brackets in final text
      const finalText = await textarea.inputValue();
      expect(finalText).not.toContain('[');
      expect(finalText).not.toContain(']');

      // Save the comment
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear without brackets
      await expect(page.getByText('Please provide driver license by end of day for verification purposes.')).toBeVisible();
    });

    test('user can add new brackets to template text', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select template without brackets
      await page.getByLabel(/template/i).selectOption({ label: 'Processing Update' });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Add brackets to the text
      await textarea.fill(await textarea.inputValue() + ' [Expected completion: 3 days]');

      // Save should work with added brackets
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear with the added brackets
      await expect(page.getByText(/\[Expected completion: 3 days\]/)).toBeVisible();
    });

    test('character count updates live as user types', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Get initial character count
      const initialText = await textarea.inputValue();
      const initialLength = initialText.length;
      await expect(page.getByText(new RegExp(`${initialLength}/1000 characters`))).toBeVisible();

      // Type additional text
      await textarea.press('End'); // Move to end
      await textarea.type(' Additional text here.');

      // Character count should update
      const newLength = initialLength + 22; // Length of ' Additional text here.'
      await expect(page.getByText(new RegExp(`${newLength}/1000 characters`))).toBeVisible();

      // Clear all text
      await textarea.clear();
      await expect(page.getByText('0/1000 characters')).toBeVisible();

      // Type new text
      await textarea.fill('Short');
      await expect(page.getByText('5/1000 characters')).toBeVisible();
    });
  });

  test.describe('Validation with Full Text Editing', () => {
    test('shows error when comment text is empty', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Clear all text
      await textarea.clear();

      // Try to save
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/comment text cannot be empty/i)).toBeVisible();

      // Comment should not be saved
      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByText('Completely different text')).not.toBeVisible();
    });

    test('shows error when comment text is only whitespace', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Enter only whitespace
      await textarea.clear();
      await textarea.fill('   \n\t   ');

      // Try to save
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/comment text cannot be empty/i)).toBeVisible();
    });

    test('shows error when comment exceeds 1000 characters', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Enter text exceeding 1000 characters
      const longText = 'a'.repeat(1001);
      await textarea.clear();
      await textarea.fill(longText);

      // Character count should show over limit
      await expect(page.getByText('1001/1000 characters')).toBeVisible();

      // Try to save
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show validation error
      await expect(page.getByText(/cannot exceed 1000 characters/i)).toBeVisible();
    });

    test('no error for unreplaced placeholders (brackets are just text)', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select template with brackets/placeholders
      await page.getByLabel(/template/i).selectOption({ label: 'Document Required' });

      // Don't replace the placeholders, just save as-is
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should NOT show placeholder error
      await expect(page.getByText(/placeholders must be replaced/i)).not.toBeVisible();
      await expect(page.getByText(/all placeholders must/i)).not.toBeVisible();

      // Comment should be saved with brackets intact
      await expect(page.getByText(/\[document type\]/)).toBeVisible();
      await expect(page.getByText(/\[date\]/)).toBeVisible();
    });

    test('requires template selection before allowing text entry', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Before selecting template, textarea should be disabled or not visible
      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Check if textarea exists and is disabled, or doesn't exist
      const textareaCount = await textarea.count();
      if (textareaCount > 0) {
        await expect(textarea).toBeDisabled();
      } else {
        await expect(textarea).not.toBeVisible();
      }

      // Add Comment button should be disabled
      await expect(page.getByRole('button', { name: /add comment|save/i })).toBeDisabled();

      // Select a template
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      // Now textarea should be enabled
      await expect(page.getByRole('textbox', { name: /comment text/i })).toBeEditable();

      // Add Comment button should be enabled
      await expect(page.getByRole('button', { name: /add comment|save/i })).toBeEnabled();
    });
  });

  test.describe('Template ID Tracking', () => {
    test('tracks original template ID even when text is completely changed', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select a specific template
      await page.getByLabel(/template/i).selectOption({ label: 'Document Required' });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Completely replace the template text
      await textarea.clear();
      await textarea.fill('This has nothing to do with documents anymore');

      // Save the comment
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // The template name should still be shown (for tracking)
      await expect(page.getByText('Document Required')).toBeVisible();

      // But the text should be the new text
      await expect(page.getByText('This has nothing to do with documents anymore')).toBeVisible();
    });
  });

  test.describe('Visibility Settings', () => {
    test('defaults to Internal Only checked', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      // Internal Only checkbox should be checked by default
      const internalCheckbox = page.getByLabel(/internal only/i);
      await expect(internalCheckbox).toBeChecked();

      // Save with default settings
      const textarea = page.getByRole('textbox', { name: /comment text/i });
      await textarea.fill('Internal comment with [details]');
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show as internal
      await expect(page.getByText(/internal/i)).toBeVisible();
    });

    test('user can make comment external', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      // Uncheck Internal Only
      const internalCheckbox = page.getByLabel(/internal only/i);
      await internalCheckbox.uncheck();
      await expect(internalCheckbox).not.toBeChecked();

      // Add comment text
      const textarea = page.getByRole('textbox', { name: /comment text/i });
      await textarea.fill('Customer visible comment with [brackets]');

      // Save
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Should show as external
      await expect(page.getByText(/external/i)).toBeVisible();
      await expect(page.getByText('Customer visible comment with [brackets]')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('handles special characters and brackets together', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Enter text with special characters and brackets
      await textarea.clear();
      await textarea.fill('Special chars: @#$% & [field1]: "value" <tag> {json: [array]}');

      // Save should work
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear with all special characters and brackets
      await expect(page.getByText(/Special chars.*field1.*json.*array/)).toBeVisible();
    });

    test('handles unicode and international brackets', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });

      // Enter text with unicode and various bracket styles
      await textarea.clear();
      await textarea.fill('Unicode: 你好 【Japanese】 〖Chinese〗 [English] مرحبا');

      // Save should work
      await page.getByRole('button', { name: /add comment|save/i }).click();

      // Comment should appear correctly
      await expect(page.getByText(/Unicode.*你好.*Japanese.*Chinese.*English/)).toBeVisible();
    });

    test('handles template switching with edited text', async ({ page }) => {
      // Navigate to service
      await page.getByRole('link', { name: /orders/i }).click();
      await page.getByRole('row').filter({ hasText: 'Processing' }).first().click();
      await page.getByRole('tab').first().click();

      // Open comment modal
      await page.getByRole('button', { name: /add comment/i }).click();

      // Select first template
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      const textarea = page.getByRole('textbox', { name: /comment text/i });
      const firstTemplateText = await textarea.inputValue();

      // Edit the text
      await textarea.fill(firstTemplateText + ' [edited]');

      // Switch to different template
      await page.getByLabel(/template/i).selectOption({ index: 2 });

      // Text should be replaced with new template
      const newText = await textarea.inputValue();
      expect(newText).not.toContain('[edited]');

      // Switch back to first template
      await page.getByLabel(/template/i).selectOption({ index: 1 });

      // Should show original template text, not the edited version
      const resetText = await textarea.inputValue();
      expect(resetText).toBe(firstTemplateText);
      expect(resetText).not.toContain('[edited]');
    });
  });
});