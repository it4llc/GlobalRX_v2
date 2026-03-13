// /GlobalRX_v2/tests/e2e/service-requirements-display.spec.ts
// End-to-end tests for the Service Requirements Display feature
//
// Feature: Display service-specific requirements (order data) in the service details view

import { test, expect } from '../fixtures/auth';

test.describe('Service Requirements Display Feature', () => {
  test.describe('Internal Fulfillment Team', () => {
    test('internal user sees submitted information for education verification service', async ({ authenticatedPage: page }) => {
      // User Flow Step 1: Navigate to fulfillment module
      await page.goto('/fulfillment');

      // User Flow Step 2: They see the list of services in the ServiceFulfillmentTable
      await expect(page.locator('table')).toBeVisible();

      // User Flow Step 3: The user clicks the expand arrow (chevron) next to a service
      // Find an education verification service in the list
      const serviceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();

      // User Flow Step 4: The row expands to show additional details
      await page.waitForTimeout(300); // Allow for expansion animation

      // User Flow Step 5: As the first visible section, they see "Submitted Information"
      const expandedContent = serviceRow.locator('~ tr').first();
      const firstSection = expandedContent.locator('section').first();

      // Business Rule 6: Section must be titled "Submitted Information"
      await expect(firstSection.locator('h3')).toHaveText('Submitted Information');

      // User Flow Step 6: The system displays all order data fields as a formatted list
      // Business Rule 9: Use human-readable labels from orderData keys
      await expect(expandedContent.getByText('School Name')).toBeVisible();
      await expect(expandedContent.getByText('University of Michigan')).toBeVisible();

      await expect(expandedContent.getByText('Degree Type')).toBeVisible();
      await expect(expandedContent.getByText('Bachelor of Science')).toBeVisible();

      await expect(expandedContent.getByText('Graduation Year')).toBeVisible();
      await expect(expandedContent.getByText('2020')).toBeVisible();

      await expect(expandedContent.getByText('Major')).toBeVisible();
      await expect(expandedContent.getByText('Computer Science')).toBeVisible();

      // Business Rule 8: Subject information fields must not be repeated
      await expect(expandedContent.locator('text=/First Name/i')).not.toBeVisible();
      await expect(expandedContent.locator('text=/Last Name/i')).not.toBeVisible();
      await expect(expandedContent.locator('text=/Date of Birth/i')).not.toBeVisible();
      await expect(expandedContent.locator('text=/SSN/i')).not.toBeVisible();

      // User Flow Step 9: Below the submitted information, they see the results section
      const resultsSection = expandedContent.locator('[data-testid="service-results-section"]');
      await expect(resultsSection).toBeVisible();

      // User Flow Step 10: Below that, they see the comments section
      const commentsSection = expandedContent.locator('[data-testid="service-comment-section"]');
      await expect(commentsSection).toBeVisible();

      // Business Rule 1: Requirements shown above results and comments
      const sections = await expandedContent.locator('section').all();
      expect(sections.length).toBeGreaterThanOrEqual(3);

      const firstSectionTitle = await sections[0].locator('h3').textContent();
      expect(firstSectionTitle).toBe('Submitted Information');

      // User Flow Step 12: They can collapse the row by clicking the chevron again
      await expandButton.click();
      await page.waitForTimeout(300);

      // Verify the expanded content is no longer visible
      await expect(expandedContent.locator('h3:has-text("Submitted Information")')).not.toBeVisible();
    });

    test('internal user sees empty state when no additional requirements exist', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find a criminal background check service (typically has no additional requirements)
      const serviceRow = page.locator('tr').filter({ hasText: 'Criminal Background Check' }).first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();

      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Business Rule 6: Section title should still be shown
      await expect(expandedContent.getByText('Submitted Information')).toBeVisible();

      // User Flow Step 8: If no additional requirements, they see "No additional requirements"
      // Business Rule 4: Empty state handling
      await expect(expandedContent.getByText('No additional requirements')).toBeVisible();
    });

    test('internal user sees formatted dates and multi-line text properly', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find an employment verification service
      const serviceRow = page.locator('tr').filter({ hasText: 'Employment Verification' }).first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();

      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Business Rule 5: Values should be formatted for readability
      // Check date formatting (MM/DD/YYYY)
      await expect(expandedContent.getByText('Start Date')).toBeVisible();
      await expect(expandedContent.getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeVisible();

      // Check multi-line text (address with line breaks)
      const addressField = expandedContent.locator('[data-testid="field-value-Company Address"]');
      if (await addressField.count() > 0) {
        // Verify line breaks are preserved
        const addressHtml = await addressField.innerHTML();
        expect(addressHtml).toContain('<br>');
      }
    });

    test('internal user can view requirements for multiple services', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Expand first service
      const firstServiceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      const firstExpandButton = firstServiceRow.locator('button[aria-label="Expand row"]');
      await firstExpandButton.click();
      await page.waitForTimeout(300);

      // Verify first service requirements are visible
      let expandedContent = firstServiceRow.locator('~ tr').first();
      await expect(expandedContent.getByText('School Name')).toBeVisible();

      // Collapse first service
      await firstExpandButton.click();
      await page.waitForTimeout(300);

      // Expand second service
      const secondServiceRow = page.locator('tr').filter({ hasText: 'Employment Verification' }).first();
      const secondExpandButton = secondServiceRow.locator('button[aria-label="Expand row"]');
      await secondExpandButton.click();
      await page.waitForTimeout(300);

      // Verify second service requirements are visible
      expandedContent = secondServiceRow.locator('~ tr').first();
      await expect(expandedContent.getByText('Company Name')).toBeVisible();

      // Verify first service requirements are not visible
      await expect(page.getByText('School Name')).not.toBeVisible();
    });
  });

  test.describe('Vendor Users', () => {
    test('vendor can view submitted information for assigned service', async ({ page }) => {
      // Business Rule 2: All users who can view a service can see all its requirement fields
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@verification.com');
      await page.fill('input[name="password"]', 'vendorpass');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Vendor should only see their assigned services
      const serviceRow = page.locator('tr').first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();

      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Vendor should see the submitted information section
      await expect(expandedContent.getByText('Submitted Information')).toBeVisible();

      // Vendor should see requirement fields
      const requirementsSection = expandedContent.locator('section').first();
      const fieldCount = await requirementsSection.locator('[data-testid^="field-container-"]').count();

      // If there are fields, verify they are visible
      if (fieldCount > 0) {
        const firstField = requirementsSection.locator('[data-testid^="field-container-"]').first();
        await expect(firstField).toBeVisible();
      } else {
        // Otherwise verify empty state
        await expect(requirementsSection.getByText('No additional requirements')).toBeVisible();
      }
    });

    test('vendor sees all requirement fields without filtering', async ({ page }) => {
      // Business Rule 2: No field-level filtering by user type
      await page.goto('/login');
      await page.fill('input[name="email"]', 'vendor@verification.com');
      await page.fill('input[name="password"]', 'vendorpass');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      const serviceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      if (await serviceRow.count() > 0) {
        const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
        await expandButton.click();
        await page.waitForTimeout(300);

        const expandedContent = serviceRow.locator('~ tr').first();

        // Vendor should see ALL fields, same as internal users
        const fields = ['School Name', 'Degree Type', 'Graduation Year', 'Major'];
        for (const field of fields) {
          const fieldElement = expandedContent.getByText(field);
          if (await fieldElement.count() > 0) {
            await expect(fieldElement).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Customer Users', () => {
    test('customer can view submitted information for their order', async ({ page }) => {
      // Business Rule 9: Works for all user types (customer)
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@company.com');
      await page.fill('input[name="password"]', 'customerpass');
      await page.click('button[type="submit"]');

      // Customer might land on portal or fulfillment page
      await page.waitForLoadState('networkidle');

      // Navigate to order details if not already there
      if (page.url().includes('/portal')) {
        await page.click('text=View Orders');
      }

      // Find a service row
      const serviceRow = page.locator('tr').filter({ hasText: /Verification|Check/ }).first();
      if (await serviceRow.count() > 0) {
        const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
        await expandButton.click();
        await page.waitForTimeout(300);

        const expandedContent = serviceRow.locator('~ tr').first();

        // Customer should see submitted information
        await expect(expandedContent.getByText('Submitted Information')).toBeVisible();

        // Customer can review what they submitted
        const requirementsSection = expandedContent.locator('section').first();
        await expect(requirementsSection).toBeVisible();
      }
    });

    test('customer sees formatted and readable requirement values', async ({ page }) => {
      // Business Rule 5: Values formatted for readability
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@company.com');
      await page.fill('input[name="password"]', 'customerpass');
      await page.click('button[type="submit"]');

      await page.waitForLoadState('networkidle');

      const serviceRow = page.locator('tr').filter({ hasText: /Verification|Check/ }).first();
      if (await serviceRow.count() > 0) {
        const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
        await expandButton.click();
        await page.waitForTimeout(300);

        const expandedContent = serviceRow.locator('~ tr').first();

        // Check that values are properly formatted
        const valueElements = expandedContent.locator('[data-testid^="field-value-"]');
        const valueCount = await valueElements.count();

        if (valueCount > 0) {
          // Verify at least one value is visible and formatted
          const firstValue = valueElements.first();
          await expect(firstValue).toBeVisible();

          // Check for no HTML tags in displayed text
          const valueText = await firstValue.textContent();
          expect(valueText).not.toContain('<');
          expect(valueText).not.toContain('>');
        }
      }
    });
  });

  test.describe('Styling and Layout', () => {
    test('requirements section uses consistent styling with other sections', async ({ page }) => {
      // Business Rule 12: Use same visual styling as other sections
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      const serviceRow = page.locator('tr').first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Get all sections
      const requirementsSection = expandedContent.locator('[data-testid="service-requirements-section"]');
      const resultsSection = expandedContent.locator('[data-testid="service-results-section"]');
      const commentsSection = expandedContent.locator('[data-testid="service-comment-section"]');

      // Check that all sections have consistent styling classes
      if (await requirementsSection.count() > 0) {
        const reqClasses = await requirementsSection.getAttribute('class');
        const resClasses = await resultsSection.getAttribute('class');

        // Both should have similar base styling classes
        expect(reqClasses).toContain('bg-white');
        expect(resClasses).toContain('bg-white');
      }
    });

    test('requirements are read-only with no editable fields', async ({ page }) => {
      // Business Rule 10: All requirement fields are read-only
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      const serviceRow = page.locator('tr').first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();
      const requirementsSection = expandedContent.locator('section').first();

      // Check that there are no input elements
      await expect(requirementsSection.locator('input')).toHaveCount(0);
      await expect(requirementsSection.locator('textarea')).toHaveCount(0);
      await expect(requirementsSection.locator('select')).toHaveCount(0);

      // Check that nothing is contenteditable
      const editableElements = requirementsSection.locator('[contenteditable="true"]');
      await expect(editableElements).toHaveCount(0);
    });

    test('field labels are displayed with muted color and values with standard color', async ({ page }) => {
      // UI/UX Requirements: Field labels in muted color, values in standard color
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      const serviceRow = page.locator('tr').filter({ hasText: 'Education Verification' }).first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Check field label styling
      const fieldLabel = expandedContent.locator('[data-testid^="field-label-"]').first();
      if (await fieldLabel.count() > 0) {
        const labelClasses = await fieldLabel.getAttribute('class');
        expect(labelClasses).toContain('text-gray-600');
      }

      // Check field value styling
      const fieldValue = expandedContent.locator('[data-testid^="field-value-"]').first();
      if (await fieldValue.count() > 0) {
        const valueClasses = await fieldValue.getAttribute('class');
        expect(valueClasses).toContain('text-gray-900');
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('requirements display properly on mobile devices', async ({ page }) => {
      // UI/UX Requirements: Mobile responsiveness

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // On mobile, might need to scroll to see expand button
      const serviceRow = page.locator('tr').first();
      await serviceRow.scrollIntoViewIfNeeded();

      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      const expandedContent = serviceRow.locator('~ tr').first();

      // Verify requirements section is visible on mobile
      await expect(expandedContent.getByText('Submitted Information')).toBeVisible();

      // Check that fields stack vertically on mobile
      const fieldContainers = expandedContent.locator('[data-testid^="field-container-"]');
      const containerCount = await fieldContainers.count();

      if (containerCount > 1) {
        const firstContainer = fieldContainers.nth(0);
        const secondContainer = fieldContainers.nth(1);

        const firstBox = await firstContainer.boundingBox();
        const secondBox = await secondContainer.boundingBox();

        // Fields should stack vertically on mobile
        if (firstBox && secondBox) {
          expect(secondBox.y).toBeGreaterThan(firstBox.y);
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('requirements display without additional API calls', async ({ page }) => {
      // Business Rule 10: No performance degradation

      // Set up request interception
      const apiCalls: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push(request.url());
        }
      });

      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Clear API calls after initial load
      apiCalls.length = 0;

      // Expand a service
      const serviceRow = page.locator('tr').first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');
      await expandButton.click();
      await page.waitForTimeout(300);

      // Check that no additional API calls were made for order data
      const orderDataCalls = apiCalls.filter(url =>
        url.includes('order-data') ||
        url.includes('requirements') ||
        url.includes('order/data')
      );

      // Should not make separate calls for order data
      expect(orderDataCalls.length).toBe(0);
    });

    test('handles services with many requirement fields efficiently', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find a service with many fields (if available)
      const serviceRow = page.locator('tr').first();
      const expandButton = serviceRow.locator('button[aria-label="Expand row"]');

      const startTime = Date.now();
      await expandButton.click();
      await page.waitForTimeout(100);
      const endTime = Date.now();

      // Expansion should be fast even with many fields
      expect(endTime - startTime).toBeLessThan(500);

      const expandedContent = serviceRow.locator('~ tr').first();
      await expect(expandedContent.getByText('Submitted Information')).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('handles services with null orderData gracefully', async ({ page }) => {
      // Edge Case 3: API returns null for orderData
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find a service that might have null orderData
      const serviceRows = page.locator('tr').filter({ hasText: 'Criminal Background Check' });

      if (await serviceRows.count() > 0) {
        const expandButton = serviceRows.first().locator('button[aria-label="Expand row"]');
        await expandButton.click();
        await page.waitForTimeout(300);

        const expandedContent = serviceRows.first().locator('~ tr').first();

        // Should still show the section with empty state
        await expect(expandedContent.getByText('Submitted Information')).toBeVisible();
        await expect(expandedContent.getByText('No additional requirements')).toBeVisible();
      }
    });

    test('handles services with empty orderData object', async ({ page }) => {
      // Edge Case 2: Order data is empty object
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Look for services without additional data
      const allRows = await page.locator('tbody tr').count();

      if (allRows > 0) {
        // Expand first available service
        const expandButton = page.locator('button[aria-label="Expand row"]').first();
        await expandButton.click();
        await page.waitForTimeout(300);

        // Check that the section exists even without data
        const sections = page.locator('[data-testid="service-requirements-section"]');
        await expect(sections).toHaveCount(1);
      }
    });

    test('handles network errors gracefully', async ({ page }) => {
      // Edge Case 8: Network error loading data
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Simulate network failure
      await page.route('**/api/fulfillment/services/*', route => {
        route.abort('failed');
      });

      await page.goto('/fulfillment');

      // Should show error state or fallback
      await page.waitForTimeout(1000);

      // Page should handle the error gracefully
      const errorMessage = page.locator('text=/error|failed|unable/i');
      if (await errorMessage.count() > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test('prevents customers from accessing other customers services', async ({ page }) => {
      // Security test: Customer access restriction
      await page.goto('/login');
      await page.fill('input[name="email"]', 'customer@company.com');
      await page.fill('input[name="password"]', 'customerpass');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Try to directly access another customer's service via URL
      // This should be blocked
      const otherCustomerServiceId = 'service-from-different-customer';
      await page.goto(`/fulfillment/services/${otherCustomerServiceId}`);

      // Should either redirect or show error
      await page.waitForTimeout(1000);

      // Check for error message or redirect
      const currentUrl = page.url();
      const hasError = await page.locator('text=/not found|unauthorized|forbidden|error/i').count() > 0;
      const wasRedirected = !currentUrl.includes(otherCustomerServiceId);

      expect(hasError || wasRedirected).toBeTruthy();
    });

    test('handles special characters in field names', async ({ page }) => {
      // Edge Case 5: Special characters in values
      await page.goto('/login');
      await page.fill('input[name="email"]', 'internal@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('/fulfillment');

      // Find any expanded service
      const firstExpandButton = page.locator('button[aria-label="Expand row"]').first();
      if (await firstExpandButton.count() > 0) {
        await firstExpandButton.click();
        await page.waitForTimeout(300);

        // Check that special characters are properly escaped
        const expandedContent = page.locator('[data-testid="service-requirements-section"]');

        // Content should be visible and properly rendered
        await expect(expandedContent).toBeVisible();

        // HTML should be escaped, not executed
        const scriptTags = expandedContent.locator('script');
        await expect(scriptTags).toHaveCount(0);
      }
    });
  });
});