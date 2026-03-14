// /GlobalRX_v2/tests/e2e/order-display-bugs.spec.ts
import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for order creation display bugs
 * These tests prove three bugs exist in the new order workflow
 */
test.describe('Order Creation Display Bugs', () => {
  test.beforeEach(async ({ page }) => {
    // Login as a customer user who can create orders
    await page.goto('/login');
    await page.fill('input[name="email"]', 'customer@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/portal/**');

    // Navigate to new order page
    await page.goto('/portal/orders/new');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Bug #1: Address Block Sub-field Asterisks', () => {
    test('SHOULD FAIL: Shows asterisks on optional address sub-fields', async ({ page }) => {
      // Navigate to the subject information step (assuming it's step 2)
      await page.click('text=Select Services'); // Step 1
      // Add a service to enable next
      await page.click('text=Add Service');
      await page.click('button:has-text("Next")');

      // Now on Subject Information step with address fields
      await page.waitForSelector('text=Subject Information');

      // Find the address block section
      const addressSection = page.locator('.space-y-4.border.border-gray-200');

      // Check for Apt/Suite field (which should be optional)
      const aptLabel = addressSection.locator('label:has-text("Apt/Suite")');

      // Bug: This optional field incorrectly shows an asterisk
      // The asterisk selector should not find anything for optional fields
      const aptAsterisk = aptLabel.locator('.text-red-500:has-text("*")');

      // This assertion will FAIL, proving the bug exists
      await expect(aptAsterisk).not.toBeVisible();
    });

    test('SHOULD FAIL: Shows asterisks on optional county field', async ({ page }) => {
      // Navigate to subject information step
      await page.click('text=Select Services');
      await page.click('text=Add Service');
      await page.click('button:has-text("Next")');

      await page.waitForSelector('text=Subject Information');

      // Find the address block
      const addressSection = page.locator('.space-y-4.border.border-gray-200');

      // Check County field (optional)
      const countyLabel = addressSection.locator('label:has-text("County")');
      const countyAsterisk = countyLabel.locator('.text-red-500:has-text("*")');

      // This assertion will FAIL, proving the bug
      await expect(countyAsterisk).not.toBeVisible();
    });
  });

  test.describe('Bug #2: Order Summary Field Asterisks', () => {
    test('SHOULD FAIL: Shows asterisks in order summary for filled values', async ({ page }) => {
      // Fill out the form through to the review step
      // Step 1: Add services
      await page.click('text=Select Services');
      await page.click('text=Add Service');
      await page.selectOption('select[name="service"]', { index: 1 });
      await page.selectOption('select[name="location"]', { index: 1 });
      await page.click('button:has-text("Add to Order")');
      await page.click('button:has-text("Next")');

      // Step 2: Fill subject information
      await page.waitForSelector('text=Subject Information');
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.fill('input[name="street1"]', '123 Main St');
      await page.fill('input[name="city"]', 'New York');
      await page.selectOption('select[name="state"]', 'NY');
      await page.fill('input[name="postalCode"]', '10001');
      await page.click('button:has-text("Next")');

      // Step 3: Now on review step
      await page.waitForSelector('text=Review Order');

      // Find the Order Summary section
      const orderSummary = page.locator('.bg-gray-50:has-text("Order Summary")');

      // Within the summary, find the Subject Information section
      const subjectSection = orderSummary.locator('div:has-text("Subject Information")');

      // Look for First Name field in summary
      const firstNameRow = subjectSection.locator('.flex:has-text("First Name:")');

      // Bug: The field name in the summary should NOT have an asterisk
      // since we're displaying already-provided values
      const asteriskInSummary = firstNameRow.locator('.text-red-500:has-text("*")');

      // This assertion will FAIL, proving the bug exists
      await expect(asteriskInSummary).not.toBeVisible();
    });

    test('Summary should not show any asterisks for provided values', async ({ page }) => {
      // Navigate through full order flow
      await page.click('text=Select Services');
      await page.click('text=Add Service');
      await page.selectOption('select[name="service"]', { index: 1 });
      await page.selectOption('select[name="location"]', { index: 1 });
      await page.click('button:has-text("Add to Order")');
      await page.click('button:has-text("Next")');

      // Fill subject info
      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.click('button:has-text("Next")');

      // On review page
      await page.waitForSelector('text=Review Order');

      const orderSummary = page.locator('.bg-gray-50:has-text("Order Summary")');

      // Count all asterisks in the summary section
      const allAsterisks = orderSummary.locator('.text-red-500:has-text("*")');

      // Correct behavior: no asterisks should appear in summary
      await expect(allAsterisks).toHaveCount(0);
    });
  });

  test.describe('Bug #3: Section Ordering', () => {
    test('SHOULD FAIL: Shows Services section before Subject Information', async ({ page }) => {
      // Navigate to review step with data
      await page.click('text=Select Services');
      await page.click('text=Add Service');
      await page.selectOption('select[name="service"]', { index: 1 });
      await page.click('button:has-text("Add to Order")');
      await page.click('button:has-text("Next")');

      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.click('button:has-text("Next")');

      await page.waitForSelector('text=Review Order');

      // Get the order summary container
      const orderSummary = page.locator('.bg-gray-50:has-text("Order Summary")');

      // Get all h5 section headers in order
      const sectionHeaders = orderSummary.locator('h5');

      // Get the text of the first section header
      const firstSectionText = await sectionHeaders.first().textContent();

      // Bug: Currently shows "Services" first instead of "Subject Information"
      // This assertion will FAIL, proving the bug exists
      expect(firstSectionText).toContain('Subject Information');
    });

    test('Sections should appear in correct order: Subject, Services, Documents', async ({ page }) => {
      // Complete order flow
      await page.click('text=Select Services');
      await page.click('text=Add Service');
      await page.selectOption('select[name="service"]', { index: 1 });
      await page.click('button:has-text("Add to Order")');
      await page.click('button:has-text("Next")');

      await page.fill('input[name="firstName"]', 'John');
      await page.fill('input[name="lastName"]', 'Doe');
      await page.click('button:has-text("Next")');

      // Upload a document if required
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles('test-document.pdf');
      }

      await page.waitForSelector('text=Review Order');

      const orderSummary = page.locator('.bg-gray-50:has-text("Order Summary")');
      const sectionHeaders = orderSummary.locator('h5');

      // Get all section header texts
      const headerTexts = await sectionHeaders.allTextContents();

      // Verify correct order
      expect(headerTexts[0]).toContain('Subject Information');
      expect(headerTexts[1]).toContain('Services');
      if (headerTexts.length > 2) {
        expect(headerTexts[2]).toContain('Documents');
      }
    });
  });

  test('Complete order flow with all three bugs visible', async ({ page }) => {
    /**
     * This test demonstrates all three bugs in a single flow
     * It will fail until all bugs are fixed
     */

    // Step 1: Add services
    await page.click('text=Select Services');
    await page.click('text=Add Service');
    await page.selectOption('select[name="service"]', { index: 1 });
    await page.selectOption('select[name="location"]', { index: 1 });
    await page.click('button:has-text("Add to Order")');
    await page.click('button:has-text("Next")');

    // Step 2: Fill subject information
    await page.waitForSelector('text=Subject Information');

    // Bug #1: Check address block asterisks
    const addressSection = page.locator('.space-y-4.border.border-gray-200');
    const aptLabel = addressSection.locator('label:has-text("Apt/Suite")');
    const aptAsterisk = aptLabel.locator('.text-red-500:has-text("*")');

    // Optional field should not have asterisk
    await expect(aptAsterisk).not.toBeVisible();

    // Fill required fields
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="street1"]', '123 Main St');
    await page.fill('input[name="city"]', 'New York');
    await page.selectOption('select[name="state"]', 'NY');
    await page.fill('input[name="postalCode"]', '10001');
    await page.click('button:has-text("Next")');

    // Step 3: Review page
    await page.waitForSelector('text=Review Order');

    const orderSummary = page.locator('.bg-gray-50:has-text("Order Summary")');

    // Bug #2: Check summary asterisks
    const summaryAsterisks = orderSummary.locator('.text-red-500:has-text("*")');
    await expect(summaryAsterisks).toHaveCount(0); // No asterisks in summary

    // Bug #3: Check section ordering
    const sectionHeaders = orderSummary.locator('h5');
    const firstSection = await sectionHeaders.first().textContent();
    expect(firstSection).toContain('Subject Information'); // Not "Services"
  });
});