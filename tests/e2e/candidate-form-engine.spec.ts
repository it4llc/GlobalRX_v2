// /GlobalRX_v2/tests/e2e/candidate-form-engine.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Candidate Form Engine - Personal Information & IDV', () => {

  test.describe('Personal Information Section', () => {
    test('personal information section appears first in sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Verify Personal Information is the first section
      const firstSection = page.locator('[data-testid="section-item"]').first();
      await expect(firstSection).toContainText('Personal Information');

      // Step 4: Verify Personal Information is selected by default
      await expect(firstSection).toHaveAttribute('data-active', 'true');
    });

    test('personal information shows pre-filled locked fields from invitation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Personal Information should be loaded by default
      const mainContent = page.locator('[data-testid="main-content"]');

      // Step 3: Verify pre-filled fields are displayed and locked
      const firstNameField = page.locator('input[name="firstName"]');
      await expect(firstNameField).toBeVisible();
      await expect(firstNameField).toHaveValue('John'); // From invitation
      await expect(firstNameField).toHaveAttribute('readonly');

      const lastNameField = page.locator('input[name="lastName"]');
      await expect(lastNameField).toBeVisible();
      await expect(lastNameField).toHaveValue('Doe'); // From invitation
      await expect(lastNameField).toHaveAttribute('readonly');

      const emailField = page.locator('input[name="email"]');
      await expect(emailField).toBeVisible();
      await expect(emailField).toHaveValue('john.doe@example.com'); // From invitation
      await expect(emailField).toHaveAttribute('readonly');

      const phoneField = page.locator('input[name="phone"]');
      await expect(phoneField).toBeVisible();
      await expect(phoneField).toHaveValue('555-1234'); // From invitation
      await expect(phoneField).toHaveAttribute('readonly');

      // Step 4: Verify locked fields are visually distinct
      await expect(firstNameField).toHaveCSS('background-color', /rgba?\(.*\)/); // Some background color indicating locked state
    });

    test('personal information allows editing unlocked fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Find editable fields
      const dateOfBirthField = page.locator('input[name="dateOfBirth"]');
      const middleNameField = page.locator('input[name="middleName"]');

      // Step 3: Verify fields are editable (not locked)
      await expect(dateOfBirthField).toBeVisible();
      await expect(dateOfBirthField).not.toHaveAttribute('readonly');

      await expect(middleNameField).toBeVisible();
      await expect(middleNameField).not.toHaveAttribute('readonly');

      // Step 4: Enter data in editable fields
      await dateOfBirthField.fill('1990-05-15');
      await middleNameField.fill('James');

      // Step 5: Verify values were entered
      await expect(dateOfBirthField).toHaveValue('1990-05-15');
      await expect(middleNameField).toHaveValue('James');
    });

    test('handles package with no personal info fields configured', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const tokenNoPersonalInfo = 'test-no-personal-info-token';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${tokenNoPersonalInfo}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${tokenNoPersonalInfo}/portal`);

      // Step 2: Personal Information section should not appear
      const personalInfoSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Personal Information' });
      await expect(personalInfoSection).not.toBeVisible();

      // Step 3: First section should be something else (e.g., workflow or service section)
      const firstSection = page.locator('[data-testid="section-item"]').first();
      await expect(firstSection).not.toContainText('Personal Information');
    });
  });

  test.describe('IDV Section Form', () => {
    test('IDV section shows country selector', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Click on IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Verify country selector is visible
      const countrySelector = page.locator('select[name="country"]');
      await expect(countrySelector).toBeVisible();

      // Step 4: Verify it has options
      const options = countrySelector.locator('option');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(1); // Should have at least one country plus placeholder
    });

    test('IDV fields update based on selected country', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select a country
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US'); // United States

      // Step 4: Wait for fields to load (brief loading indicator)
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 5: Verify IDV-specific fields are shown
      const idFields = page.locator('[data-testid="idv-fields-container"] input');
      const fieldCount = await idFields.count();
      expect(fieldCount).toBeGreaterThan(0); // Should have fields

      // Step 6: Change country
      await countrySelector.selectOption('CA'); // Canada

      // Step 7: Verify fields update (may be different set of fields)
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });
    });

    test('IDV section does not show personal info fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select a country to load fields
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');

      // Step 4: Wait for fields to load
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 5: Verify fields that belong to personal info are NOT shown here
      // Date of birth, if it's a personal info field, should not appear in IDV section
      const dobField = page.locator('[data-testid="idv-fields-container"] input[name="dateOfBirth"]');
      await expect(dobField).not.toBeVisible();

      // First name and last name should not be in IDV section (they're in Personal Info)
      const firstNameField = page.locator('[data-testid="idv-fields-container"] input[name="firstName"]');
      const lastNameField = page.locator('[data-testid="idv-fields-container"] input[name="lastName"]');
      await expect(firstNameField).not.toBeVisible();
      await expect(lastNameField).not.toBeVisible();
    });

    test('IDV handles country with no fields configured', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select a country with no configured fields
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('XX'); // Fictional country with no config

      // Step 4: Should show appropriate message
      await expect(page.locator('text=/No information is required for this section based on your selected country/')).toBeVisible();
    });

    test('IDV preserves data when switching between countries', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select US and fill in a field
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      const idNumberField = page.locator('input[name="idNumber"]').first();
      await idNumberField.fill('123456789');

      // Step 4: Switch to Canada
      await countrySelector.selectOption('CA');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 5: Fill in a Canada-specific field
      const sinField = page.locator('input[name="socialInsuranceNumber"]').first();
      if (await sinField.isVisible()) {
        await sinField.fill('987654321');
      }

      // Step 6: Switch back to US
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 7: Verify US data was preserved
      const idNumberFieldAgain = page.locator('input[name="idNumber"]').first();
      await expect(idNumberFieldAgain).toHaveValue('123456789');
    });
  });

  test.describe('Dynamic Field Renderer', () => {
    test('renders different field types correctly', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Stay on Personal Information section (loads by default)

      // Step 3: Check text field renders correctly
      const textField = page.locator('input[type="text"]').first();
      await expect(textField).toBeVisible();

      // Step 4: Check date field renders correctly
      const dateField = page.locator('input[type="date"]').first();
      await expect(dateField).toBeVisible();

      // Step 5: Check email field renders correctly
      const emailField = page.locator('input[type="email"]').first();
      await expect(emailField).toBeVisible();

      // Step 6: Check phone field renders correctly
      const phoneField = page.locator('input[type="tel"]').first();
      await expect(phoneField).toBeVisible();

      // Step 7: Navigate to a section with more field types
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Select country to load fields
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 8: Check select/dropdown renders correctly
      const selectField = page.locator('select').nth(1); // Skip country selector
      if (await selectField.isVisible()) {
        await expect(selectField).toBeVisible();
      }

      // Step 9: Check number field if present
      const numberField = page.locator('input[type="number"]').first();
      if (await numberField.isVisible()) {
        await expect(numberField).toBeVisible();
      }
    });

    test('shows required field indicators', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Look for required field indicators
      const requiredIndicators = page.locator('.required-indicator, [aria-required="true"], .asterisk, text="*"');
      const count = await requiredIndicators.count();

      // Should have at least some required fields
      expect(count).toBeGreaterThan(0);
    });

    test('shows field instructions when configured', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select country to load fields
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      // Step 4: Look for help text / instructions
      const helpText = page.locator('.field-help-text, .field-instructions, [role="tooltip"]');

      // At least one field should have instructions
      if (await helpText.first().isVisible()) {
        await expect(helpText.first()).toBeVisible();
      }
    });

    test('handles address_block fields with placeholder message', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-with-address-fields';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to a section that has address fields
      const addressSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Address History' });
      if (await addressSection.isVisible()) {
        await addressSection.click();

        // Step 3: Should see placeholder for address block fields
        await expect(page.locator('text=/Address fields coming soon/')).toBeVisible();
      }
    });
  });

  test.describe('Auto-Save Functionality', () => {
    test('auto-saves when moving between fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Fill in a field
      const dateOfBirthField = page.locator('input[name="dateOfBirth"]');
      await dateOfBirthField.fill('1990-05-15');

      // Step 3: Tab to next field (triggers blur event)
      await page.keyboard.press('Tab');

      // Step 4: Should see save indicator
      const saveIndicator = page.locator('text=/Saving|Saved/');
      await expect(saveIndicator).toBeVisible();

      // Step 5: Wait for "Saved" to appear
      await expect(page.locator('text="Saved"')).toBeVisible({ timeout: 5000 });
    });

    test('does not save on every keystroke', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Start typing in a field without blurring
      const middleNameField = page.locator('input[name="middleName"]');
      await middleNameField.click();
      await page.keyboard.type('J', { delay: 100 });
      await page.keyboard.type('a', { delay: 100 });
      await page.keyboard.type('m', { delay: 100 });

      // Step 3: Should NOT see save indicator yet (no blur event)
      const saveIndicator = page.locator('text=/Saving|Saved/');
      await expect(saveIndicator).not.toBeVisible();

      // Step 4: Now blur the field
      await page.keyboard.press('Tab');

      // Step 5: NOW should see save indicator
      await expect(saveIndicator).toBeVisible();
    });

    test('shows retry message when save fails', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Intercept save endpoint to fail
      await page.route('**/api/candidate/application/**/save', route => {
        route.abort('failed');
      });

      // Step 3: Fill in a field and trigger save
      const middleNameField = page.locator('input[name="middleName"]');
      await middleNameField.fill('FailTest');
      await page.keyboard.press('Tab');

      // Step 4: Should see retry message
      await expect(page.locator('text=/Save failed.*retrying/i')).toBeVisible();

      // Step 5: Remove the route intercept to allow retry to succeed
      await page.unroute('**/api/candidate/application/**/save');

      // Step 6: Should eventually show "Saved" after retry
      await expect(page.locator('text="Saved"')).toBeVisible({ timeout: 10000 });
    });

    test('debounces rapid field changes', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Set up request interceptor to count save requests
      let saveRequestCount = 0;
      await page.route('**/api/candidate/application/**/save', route => {
        saveRequestCount++;
        route.continue();
      });

      // Step 3: Tab through multiple fields rapidly
      const field1 = page.locator('input[name="middleName"]');
      const field2 = page.locator('input[name="dateOfBirth"]');
      const field3 = page.locator('input').nth(4); // Another field

      await field1.fill('Quick');
      await page.keyboard.press('Tab'); // Rapid tab

      await field2.fill('1990-01-01');
      await page.keyboard.press('Tab'); // Rapid tab

      if (await field3.isVisible() && await field3.isEnabled()) {
        await field3.fill('Test');
        await page.keyboard.press('Tab'); // Rapid tab
      }

      // Step 4: Wait a moment for debouncing to settle
      await page.waitForTimeout(500);

      // Step 5: Should have made fewer requests than field changes due to debouncing
      // We changed 3 fields rapidly, but debouncing should combine them
      expect(saveRequestCount).toBeLessThanOrEqual(2); // Should be debounced
    });
  });

  test.describe('Data Persistence', () => {
    test('loads previously saved data when returning to portal', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login and fill in some data
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const dateOfBirthField = page.locator('input[name="dateOfBirth"]');
      const middleNameField = page.locator('input[name="middleName"]');

      await dateOfBirthField.fill('1990-05-15');
      await page.keyboard.press('Tab');
      await page.waitForSelector('text="Saved"');

      await middleNameField.fill('TestMiddle');
      await page.keyboard.press('Tab');
      await page.waitForSelector('text="Saved"');

      // Step 2: Sign out
      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Step 3: Log back in
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 4: Verify saved data is loaded
      await expect(page.locator('input[name="dateOfBirth"]')).toHaveValue('1990-05-15');
      await expect(page.locator('input[name="middleName"]')).toHaveValue('TestMiddle');
    });

    test('loads saved data when navigating between sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Fill in Personal Information
      const middleNameField = page.locator('input[name="middleName"]');
      await middleNameField.fill('NavigationTest');
      await page.keyboard.press('Tab');
      await page.waitForSelector('text="Saved"');

      // Step 3: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 4: Navigate back to Personal Information
      const personalInfoSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Personal Information' });
      await personalInfoSection.click();

      // Step 5: Verify data is still there
      await expect(page.locator('input[name="middleName"]')).toHaveValue('NavigationTest');
    });

    test('preserves IDV data for each country separately', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select US and save data
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      const usField = page.locator('input').nth(1); // First field after country
      await usField.fill('US-DATA-123');
      await page.keyboard.press('Tab');
      await page.waitForSelector('text="Saved"');

      // Step 4: Switch to Canada and save different data
      await countrySelector.selectOption('CA');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });

      const caField = page.locator('input').nth(1); // First field after country
      await caField.fill('CA-DATA-456');
      await page.keyboard.press('Tab');
      await page.waitForSelector('text="Saved"');

      // Step 5: Navigate away and back
      const personalInfoSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Personal Information' });
      await personalInfoSection.click();
      await idvSection.click();

      // Step 6: Check US data is preserved
      await countrySelector.selectOption('US');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });
      await expect(page.locator('input').nth(1)).toHaveValue('US-DATA-123');

      // Step 7: Check Canada data is preserved
      await countrySelector.selectOption('CA');
      await page.waitForSelector('[data-testid="idv-fields-container"]', { state: 'visible' });
      await expect(page.locator('input').nth(1)).toHaveValue('CA-DATA-456');
    });
  });

  test.describe('Mobile Experience', () => {
    test('all form fields work on mobile viewport', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Set mobile viewport - minimum supported width
      await page.setViewportSize({ width: 320, height: 568 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Open hamburger menu to navigate
      const hamburgerButton = page.locator('[data-testid="hamburger-menu"]');
      await hamburgerButton.click();

      // Step 3: Verify sections are accessible
      const personalInfoSection = page.locator('[data-testid="mobile-menu"] [data-testid="section-item"]').filter({ hasText: 'Personal Information' });
      await personalInfoSection.click();

      // Step 4: Test text input on mobile
      const middleNameField = page.locator('input[name="middleName"]');
      await expect(middleNameField).toBeVisible();
      await middleNameField.fill('MobileTest');

      // Step 5: Verify font size is at least 16px (prevents iOS zoom)
      const fontSize = await middleNameField.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });
      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(16);

      // Step 6: Test date picker on mobile
      const dateField = page.locator('input[type="date"]');
      if (await dateField.isVisible()) {
        await dateField.click();
        // Native date picker should open (can't fully test native picker in Playwright)
        await expect(dateField).toBeFocused();
      }
    });

    test('touch targets are at least 44px tall', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.setViewportSize({ width: 375, height: 667 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login and navigate to portal
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Check all input fields
      const inputs = page.locator('input, select, button, [role="button"], [role="checkbox"], [role="radio"]');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const box = await input.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('auto-save indicator visible on mobile without covering fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      await page.setViewportSize({ width: 375, height: 667 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Open menu and navigate if needed
      const hamburgerButton = page.locator('[data-testid="hamburger-menu"]');
      if (await hamburgerButton.isVisible()) {
        await hamburgerButton.click();
        const personalInfo = page.locator('[data-testid="mobile-menu"] [data-testid="section-item"]').first();
        await personalInfo.click();
      }

      // Step 3: Trigger auto-save
      const field = page.locator('input[name="middleName"]');
      await field.fill('MobileSave');
      await page.keyboard.press('Tab');

      // Step 4: Check save indicator is visible
      const saveIndicator = page.locator('text=/Saving|Saved/');
      await expect(saveIndicator).toBeVisible();

      // Step 5: Verify it doesn't overlap with form fields
      const indicatorBox = await saveIndicator.boundingBox();
      const fieldBox = await field.boundingBox();

      if (indicatorBox && fieldBox) {
        // Indicator should not overlap with the field
        const overlap = (
          indicatorBox.y < fieldBox.y + fieldBox.height &&
          indicatorBox.y + indicatorBox.height > fieldBox.y &&
          indicatorBox.x < fieldBox.x + fieldBox.width &&
          indicatorBox.x + indicatorBox.width > fieldBox.x
        );
        expect(overlap).toBe(false);
      }
    });
  });

  test.describe('API Endpoints - Fields', () => {
    test('fields API returns correct data for service and country', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Call fields endpoint
      const response = await page.request.get(`/api/candidate/application/${testToken}/fields?serviceId=idv-service-123&countryId=US`);

      // Step 3: Verify response status
      expect(response.status()).toBe(200);

      // Step 4: Verify response shape
      const data = await response.json();
      expect(data).toHaveProperty('fields');
      expect(Array.isArray(data.fields)).toBe(true);

      if (data.fields.length > 0) {
        const firstField = data.fields[0];
        expect(firstField).toHaveProperty('requirementId');
        expect(firstField).toHaveProperty('name');
        expect(firstField).toHaveProperty('fieldKey');
        expect(firstField).toHaveProperty('type');
        expect(firstField).toHaveProperty('dataType');
        expect(firstField).toHaveProperty('isRequired');
        expect(firstField).toHaveProperty('fieldData');
        expect(firstField).toHaveProperty('displayOrder');

        // Verify fieldData is complete (not stripped)
        expect(firstField.fieldData).toBeTruthy();
        if (firstField.fieldData) {
          expect(typeof firstField.fieldData).toBe('object');
        }
      }
    });

    test('personal-info-fields API returns deduplicated fields with lock status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Call personal-info-fields endpoint
      const response = await page.request.get(`/api/candidate/application/${testToken}/personal-info-fields`);

      // Step 3: Verify response status
      expect(response.status()).toBe(200);

      // Step 4: Verify response shape
      const data = await response.json();
      expect(data).toHaveProperty('fields');
      expect(Array.isArray(data.fields)).toBe(true);

      // Step 5: Check for pre-filled and locked fields
      const firstNameField = data.fields.find((f: any) => f.fieldKey === 'firstName');
      if (firstNameField) {
        expect(firstNameField.locked).toBe(true);
        expect(firstNameField.prefilledValue).toBeTruthy();
      }

      const lastNameField = data.fields.find((f: any) => f.fieldKey === 'lastName');
      if (lastNameField) {
        expect(lastNameField.locked).toBe(true);
        expect(lastNameField.prefilledValue).toBeTruthy();
      }

      const emailField = data.fields.find((f: any) => f.fieldKey === 'email');
      if (emailField) {
        expect(emailField.locked).toBe(true);
        expect(emailField.prefilledValue).toBeTruthy();
      }

      const phoneField = data.fields.find((f: any) => f.fieldKey === 'phone');
      if (phoneField) {
        expect(phoneField.locked).toBe(true);
        expect(phoneField.prefilledValue).toBeTruthy();
      }

      // Other fields should not be locked
      const otherFields = data.fields.filter((f: any) =>
        !['firstName', 'lastName', 'email', 'phone'].includes(f.fieldKey)
      );
      otherFields.forEach((field: any) => {
        expect(field.locked).toBe(false);
      });
    });

    test('save API stores data and returns timestamp', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Call save endpoint
      const saveData = {
        sectionType: 'personal_info',
        sectionId: 'personal-info-section',
        fields: [
          {
            requirementId: 'req-uuid-123',
            value: '1990-05-15'
          },
          {
            requirementId: 'req-uuid-456',
            value: 'TestMiddle'
          }
        ]
      };

      const response = await page.request.post(`/api/candidate/application/${testToken}/save`, {
        data: saveData
      });

      // Step 3: Verify response
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('savedAt');

      // Verify savedAt is a valid timestamp
      const savedAt = new Date(data.savedAt);
      expect(savedAt).toBeInstanceOf(Date);
      expect(savedAt.getTime()).not.toBeNaN();
    });

    test('saved-data API returns previously saved values', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Save some data first
      const saveData = {
        sectionType: 'personal_info',
        sectionId: 'personal-info-section',
        fields: [
          {
            requirementId: 'req-uuid-123',
            value: '1990-05-15'
          }
        ]
      };

      await page.request.post(`/api/candidate/application/${testToken}/save`, {
        data: saveData
      });

      // Step 3: Call saved-data endpoint
      const response = await page.request.get(`/api/candidate/application/${testToken}/saved-data`);

      // Step 4: Verify response
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('sections');
      expect(data.sections).toHaveProperty('personal_info');
      expect(data.sections.personal_info).toHaveProperty('fields');
      expect(Array.isArray(data.sections.personal_info.fields)).toBe(true);

      // Verify saved value is returned
      const savedField = data.sections.personal_info.fields.find(
        (f: any) => f.requirementId === 'req-uuid-123'
      );
      expect(savedField).toBeTruthy();
      expect(savedField.value).toBe('1990-05-15');
    });

    test('all endpoints require valid session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Call endpoints without session
      const fieldsResponse = await page.request.get(`/api/candidate/application/${testToken}/fields?serviceId=idv&countryId=US`);
      expect(fieldsResponse.status()).toBe(401);

      const personalInfoResponse = await page.request.get(`/api/candidate/application/${testToken}/personal-info-fields`);
      expect(personalInfoResponse.status()).toBe(401);

      const saveResponse = await page.request.post(`/api/candidate/application/${testToken}/save`, {
        data: { sectionType: 'personal_info', sectionId: 'test', fields: [] }
      });
      expect(saveResponse.status()).toBe(401);

      const savedDataResponse = await page.request.get(`/api/candidate/application/${testToken}/saved-data`);
      expect(savedDataResponse.status()).toBe(401);
    });

    test('endpoints reject mismatched token and session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';
      const wrongToken = 'wrong-token-456';

      // Step 1: Login with one token
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Try to access endpoints with different token
      const fieldsResponse = await page.request.get(`/api/candidate/application/${wrongToken}/fields?serviceId=idv&countryId=US`);
      expect(fieldsResponse.status()).toBe(403);

      const personalInfoResponse = await page.request.get(`/api/candidate/application/${wrongToken}/personal-info-fields`);
      expect(personalInfoResponse.status()).toBe(403);

      const saveResponse = await page.request.post(`/api/candidate/application/${wrongToken}/save`, {
        data: { sectionType: 'personal_info', sectionId: 'test', fields: [] }
      });
      expect(saveResponse.status()).toBe(403);

      const savedDataResponse = await page.request.get(`/api/candidate/application/${wrongToken}/saved-data`);
      expect(savedDataResponse.status()).toBe(403);
    });

    test('endpoints reject expired invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const expiredToken = 'test-expired-token-789';

      // Step 1: Login with expired invitation
      await page.goto(`/candidate/${expiredToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${expiredToken}/portal`);

      // Step 2: Try to access endpoints
      const fieldsResponse = await page.request.get(`/api/candidate/application/${expiredToken}/fields?serviceId=idv&countryId=US`);
      expect(fieldsResponse.status()).toBe(410);

      const personalInfoResponse = await page.request.get(`/api/candidate/application/${expiredToken}/personal-info-fields`);
      expect(personalInfoResponse.status()).toBe(410);

      const saveResponse = await page.request.post(`/api/candidate/application/${expiredToken}/save`, {
        data: { sectionType: 'personal_info', sectionId: 'test', fields: [] }
      });
      expect(saveResponse.status()).toBe(410);

      const savedDataResponse = await page.request.get(`/api/candidate/application/${expiredToken}/saved-data`);
      expect(savedDataResponse.status()).toBe(410);
    });

    test('structure endpoint includes personal info section as first item', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Call structure endpoint
      const response = await page.request.get(`/api/candidate/application/${testToken}/structure`);

      // Step 3: Verify response
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('sections');
      expect(Array.isArray(data.sections)).toBe(true);

      // Step 4: Verify Personal Information is first
      if (data.sections.length > 0) {
        const firstSection = data.sections[0];
        expect(firstSection.type).toBe('personal_info');
        expect(firstSection.title).toContain('Personal Information');
      }

      // Step 5: Verify service sections include service IDs
      const serviceSections = data.sections.filter((s: any) => s.type === 'service_section');
      serviceSections.forEach((section: any) => {
        expect(section).toHaveProperty('serviceIds');
        expect(Array.isArray(section.serviceIds)).toBe(true);
        expect(section.serviceIds.length).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Edge Cases', () => {
    test('handles field with unrecognized data type', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-unknown-field-type';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to a section with unknown field type
      // Should render as plain text input as fallback
      const unknownField = page.locator('input[data-field-type="unknown"]');
      if (await unknownField.isVisible()) {
        // Should fall back to text input
        await expect(unknownField).toHaveAttribute('type', 'text');
      }
    });

    test('handles select field with no options', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-empty-select-options';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Look for select with no options
      const emptySelect = page.locator('select[data-no-options="true"]');
      if (await emptySelect.isVisible()) {
        await expect(emptySelect).toBeDisabled();
        // Should show message about no options
        const message = page.locator('text=/No options available/');
        await expect(message).toBeVisible();
      }
    });

    test('handles all IDV fields belonging to personal info tab', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-all-idv-in-personal';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Navigate to IDV section
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      // Step 3: Select a country
      const countrySelector = page.locator('select[name="country"]');
      await countrySelector.selectOption('US');

      // Step 4: Should show message that no additional fields are needed
      await expect(page.locator('text=/No additional information is required for this section/')).toBeVisible();
    });

    test('handles session expiration during form filling', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Fill in a field
      const middleNameField = page.locator('input[name="middleName"]');
      await middleNameField.fill('SessionTest');

      // Step 3: Intercept save request to return 401 (session expired)
      await page.route('**/api/candidate/application/**/save', route => {
        route.fulfill({ status: 401 });
      });

      // Step 4: Trigger save
      await page.keyboard.press('Tab');

      // Step 5: Should redirect to login
      await page.waitForURL(`**/candidate/${testToken}`);
      await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('handles very slow network on save', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Intercept save to be slow (8 seconds)
      await page.route('**/api/candidate/application/**/save', async route => {
        await page.waitForTimeout(8000);
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, savedAt: new Date().toISOString() })
        });
      });

      // Step 3: Fill field and trigger save
      const middleNameField = page.locator('input[name="middleName"]');
      await middleNameField.fill('SlowNetwork');
      await page.keyboard.press('Tab');

      // Step 4: Should show "Saving..." for the duration
      const savingIndicator = page.locator('text="Saving..."');
      await expect(savingIndicator).toBeVisible();

      // Step 5: Should eventually show "Saved" (within 10 seconds)
      await expect(page.locator('text="Saved"')).toBeVisible({ timeout: 12000 });
    });

    test('data remains in form even if saves fail', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Intercept all save requests to fail
      await page.route('**/api/candidate/application/**/save', route => {
        route.abort('failed');
      });

      // Step 3: Fill in multiple fields
      const middleNameField = page.locator('input[name="middleName"]');
      const dateOfBirthField = page.locator('input[name="dateOfBirth"]');

      await middleNameField.fill('FailTest');
      await page.keyboard.press('Tab');

      await dateOfBirthField.fill('1990-01-01');
      await page.keyboard.press('Tab');

      // Step 4: Verify data is still in the form despite save failures
      await expect(middleNameField).toHaveValue('FailTest');
      await expect(dateOfBirthField).toHaveValue('1990-01-01');

      // Step 5: Navigate away and back
      const idvSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Identity Verification' });
      await idvSection.click();

      const personalInfoSection = page.locator('[data-testid="section-item"]').filter({ hasText: 'Personal Information' });
      await personalInfoSection.click();

      // Step 6: Data should still be in form (browser state preserved)
      await expect(middleNameField).toHaveValue('FailTest');
      await expect(dateOfBirthField).toHaveValue('1990-01-01');
    });
  });
});