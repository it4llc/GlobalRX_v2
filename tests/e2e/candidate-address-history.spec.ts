// /GlobalRX_v2/tests/e2e/candidate-address-history.spec.ts
// Pass 1 e2e tests for Phase 6 Stage 3:
// Address History section + Address Block rendering in the candidate portal.
//
// These tests will FAIL when first run because the feature does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.

import { test, expect } from '@playwright/test';

test.describe('Candidate Address History — Phase 6 Stage 3', () => {

  // -------------------------------------------------------------------------
  // Section visibility — driven by package contents
  // -------------------------------------------------------------------------

  test.describe('Section Visibility', () => {
    test('Address History section appears at position 2 when package has record-type services', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #1, #2, #27 and DoD #11
      const testToken = 'test-record-package-token';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Verify ordered section list — Personal Info, IDV, Address History, Education, Employment
      const sectionItems = page.locator('[data-testid="section-item"]');
      await expect(sectionItems.nth(0)).toContainText('Personal Information');
      await expect(sectionItems.nth(1)).toContainText('Identity Verification');
      await expect(sectionItems.nth(2)).toContainText('Address History');
    });

    test('Address History section does NOT appear when package has no record-type services', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #1 and DoD #10
      const testToken = 'test-no-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const addressHistorySection = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' });
      await expect(addressHistorySection).toHaveCount(0);
    });

    test('Single Address History section serves all record-type services in the package', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #2: one section for criminal + civil + bankruptcy
      const testToken = 'test-multi-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const addressHistorySections = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' });
      await expect(addressHistorySections).toHaveCount(1);
    });
  });

  // -------------------------------------------------------------------------
  // Address History section — minimum-one-entry rule
  // -------------------------------------------------------------------------

  test.describe('Minimum One Entry Rule', () => {
    test('Address History always shows at least one entry on first visit', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #3 and DoD #13
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Verify "Address 1" entry is present and expanded
      await expect(page.locator('text=/Address 1/').first()).toBeVisible();
    });

    test('Remove control is hidden or disabled when only one entry exists', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #3 and DoD #13
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // The first entry's remove button should NOT be available
      const removeButton = page
        .locator('[data-testid="entry-remove-button"]')
        .first();
      await expect(removeButton).toHaveCount(0);
    });

    test('Remove button appears on first entry once a second entry is added', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec User Flow step 12: "Once a second entry exists, the remove button on the first entry becomes available."
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.getByRole('button', { name: /Add Another Address/i }).click();

      const removeButtons = page.locator('[data-testid="entry-remove-button"]');
      await expect(removeButtons).toHaveCount(2);
    });
  });

  // -------------------------------------------------------------------------
  // Address Block rendering
  // -------------------------------------------------------------------------

  test.describe('Address Block Rendering', () => {
    test('Address block placeholder is replaced with real form fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #9 and #36 — placeholder is gone
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Select a country to trigger the address block render
      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // The Stage 2 placeholder text must NOT appear anywhere on the page
      await expect(page.locator('text=/Address fields coming soon/i')).toHaveCount(0);

      // The address block fields should be rendered
      await expect(page.locator('input[name="street1"]').first()).toBeVisible();
      await expect(page.locator('input[name="city"]').first()).toBeVisible();
    });

    test('Address block applies safe default piece set when no addressConfig is configured', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #14 and DoD #4
      // Default: street1 (req), street2 (opt), city (req), state (req), postalCode (req), county (disabled)
      const testToken = 'test-default-addressconfig-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // Default-enabled pieces visible
      await expect(page.locator('input[name="street1"]').first()).toBeVisible();
      await expect(page.locator('input[name="street2"]').first()).toBeVisible();
      await expect(page.locator('input[name="city"]').first()).toBeVisible();
      await expect(page.locator('input[name="postalCode"]').first()).toBeVisible();

      // County is disabled by default — should NOT be rendered
      await expect(page.locator('input[name="county"]')).toHaveCount(0);
      await expect(page.locator('select[name="county"]')).toHaveCount(0);
    });

    test('Address block respects addressConfig — disabled pieces are not rendered', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #13 and DoD #1
      const testToken = 'test-minimal-addressconfig-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // Configured to only have street1 + city — postalCode/state are disabled
      await expect(page.locator('input[name="street1"]').first()).toBeVisible();
      await expect(page.locator('input[name="city"]').first()).toBeVisible();
      await expect(page.locator('input[name="postalCode"]')).toHaveCount(0);
    });
  });

  // -------------------------------------------------------------------------
  // Address History dates — built-in section behavior
  // -------------------------------------------------------------------------

  test.describe('Address History Date Fields', () => {
    test('Address History entries show From and To date fields automatically', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #4 and DoD #5
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      await expect(page.locator('input[name="fromDate"]').first()).toBeVisible();
      await expect(page.locator('input[name="toDate"]').first()).toBeVisible();
      await expect(page.locator('input[name="isCurrent"]').first()).toBeVisible();
    });

    test('Checking Current address hides the To date field', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #7 and DoD #15
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      await expect(page.locator('input[name="toDate"]').first()).toBeVisible();
      await page.locator('input[name="isCurrent"]').first().check();
      await expect(page.locator('input[name="toDate"]').first()).not.toBeVisible();
    });

    test('Only one Current address can be set across all entries', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #7 and DoD #15
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Add a second entry
      await page.getByRole('button', { name: /Add Another Address/i }).click();

      // Pick countries on both entries to render their date fields
      await page.locator('select[name="country"]').nth(0).selectOption({ index: 1 });
      await page.locator('select[name="country"]').nth(1).selectOption({ index: 1 });

      // Check Current on entry 1
      await page.locator('input[name="isCurrent"]').nth(0).check();
      await expect(page.locator('input[name="isCurrent"]').nth(0)).toBeChecked();

      // Check Current on entry 2 — entry 1 should auto-uncheck
      await page.locator('input[name="isCurrent"]').nth(1).check();
      await expect(page.locator('input[name="isCurrent"]').nth(1)).toBeChecked();
      await expect(page.locator('input[name="isCurrent"]').nth(0)).not.toBeChecked();
    });
  });

  // -------------------------------------------------------------------------
  // Education / Employment integration — placeholder replaced
  // -------------------------------------------------------------------------

  test.describe('Education and Employment integration', () => {
    test('Education section renders real address form (no placeholder) for address_block fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #36
      const testToken = 'test-edu-with-address-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      await expect(page.locator('text=/Address fields coming soon/i')).toHaveCount(0);
      await expect(page.locator('input[name="street1"]').first()).toBeVisible();
    });

    test('Education address block does NOT show date fields (dates are not part of address block here)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #6 and "How Are Dates Different Between Section Types?"
      const testToken = 'test-edu-with-address-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // The address block in Education has no fromDate/toDate/isCurrent — those are
      // standalone DSX fields handled separately, not nested in the address block.
      const addressBlock = page.locator('[data-testid="address-block"]').first();
      await expect(addressBlock.locator('input[name="fromDate"]')).toHaveCount(0);
      await expect(addressBlock.locator('input[name="toDate"]')).toHaveCount(0);
      await expect(addressBlock.locator('input[name="isCurrent"]')).toHaveCount(0);
    });

    test('Employment section renders real address form (no placeholder) for address_block fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #36
      const testToken = 'test-emp-with-address-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Employment History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      await expect(page.locator('text=/Address fields coming soon/i')).toHaveCount(0);
      await expect(page.locator('input[name="street1"]').first()).toBeVisible();
    });
  });

  // -------------------------------------------------------------------------
  // Subdivisions cascading
  // -------------------------------------------------------------------------

  test.describe('Subregion Cascading and Subdivisions Endpoint', () => {
    test('State dropdown populates after country selection', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #15 and DoD #23
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // The state dropdown should populate with at least one option
      const stateDropdown = page.locator('select[name="state"]').first();
      await expect(stateDropdown).toBeVisible();
      const stateOptions = stateDropdown.locator('option');
      // At least the placeholder + one real option
      await expect(stateOptions).not.toHaveCount(0);
    });

    test('State piece falls back to free-text input when country has no subdivisions', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #15 and DoD #6
      const testToken = 'test-country-no-subdivisions-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Select a country known to have no states in the database (e.g., a small country)
      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // State piece should be a text input, not a select
      await expect(page.locator('input[name="state"]').first()).toBeVisible();
      await expect(page.locator('select[name="state"]')).toHaveCount(0);
    });

    test('Changing state clears county and city dropdowns', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #9 and DoD #23
      const testToken = 'test-three-level-subregions-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Select country, state, county
      await page.locator('select[name="country"]').first().selectOption({ index: 1 });
      await page.locator('select[name="state"]').first().selectOption({ index: 1 });
      await page.locator('select[name="county"]').first().selectOption({ index: 1 });

      // Change state — county and city should clear
      await page.locator('select[name="state"]').first().selectOption({ index: 2 });
      await expect(page.locator('select[name="county"]').first()).toHaveValue('');
      await expect(page.locator('select[name="city"]').first()).toHaveValue('');
    });
  });

  // -------------------------------------------------------------------------
  // Aggregated requirements area
  // -------------------------------------------------------------------------

  test.describe('Aggregated Requirements Area', () => {
    test('Aggregated requirements area is hidden when no extra requirements are triggered', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #26
      const testToken = 'test-no-extra-requirements-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // The aggregated heading should not appear
      await expect(
        page.locator('text=/Based on your address history, we need the following/i')
      ).toHaveCount(0);
    });

    test('Aggregated requirements area shows Additional Information and Required Documents when requirements exist', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #27
      const testToken = 'test-with-aggregated-requirements-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      await expect(
        page.locator('text=/Based on your address history, we need the following/i')
      ).toBeVisible();
      await expect(page.locator('text=/Additional Information/i')).toBeVisible();
      await expect(page.locator('text=/Required Documents/i')).toBeVisible();
    });

    test('Document requirements show name and instructions only — no upload button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #24 and DoD #32
      const testToken = 'test-with-aggregated-requirements-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      // Document items are present...
      const documentSection = page.locator('[data-testid="aggregated-required-documents"]');
      await expect(documentSection).toBeVisible();

      // ...but they have no upload control in Stage 3
      await expect(documentSection.locator('input[type="file"]')).toHaveCount(0);
      await expect(documentSection.locator('button', { hasText: /Upload/i })).toHaveCount(0);
    });

    test('Same requirement triggered by multiple addresses appears only once (deduplication)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #17 and DoD #29
      const testToken = 'test-dedup-aggregated-requirements-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Add two addresses in the same country (both trigger the same requirement)
      await page.locator('select[name="country"]').nth(0).selectOption({ index: 1 });
      await page.getByRole('button', { name: /Add Another Address/i }).click();
      await page.locator('select[name="country"]').nth(1).selectOption({ index: 1 });

      // The aggregated requirement should appear exactly once
      const requirementItems = page.locator(
        '[data-testid="aggregated-additional-information"] [data-testid="aggregated-field-item"]'
      );
      await expect(requirementItems).toHaveCount(1);
    });
  });

  // -------------------------------------------------------------------------
  // Auto-save and persistence
  // -------------------------------------------------------------------------

  test.describe('Auto-Save and Persistence', () => {
    test('Auto-save fires on blur and persists address pieces with dates nested inside', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #21 and DoD #16, #17
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Capture save requests so we can verify the body shape
      const saveRequests: Array<Record<string, unknown>> = [];
      await page.route('**/api/candidate/application/**/save', async (route) => {
        const req = route.request();
        try {
          const body = req.postDataJSON();
          if (body && body.sectionType === 'address_history') {
            saveRequests.push(body);
          }
        } catch {
          // ignore non-JSON bodies
        }
        await route.continue();
      });

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });

      const street1 = page.locator('input[name="street1"]').first();
      await street1.fill('123 Main Street');
      await page.keyboard.press('Tab');

      // Wait for the auto-save to fire
      await expect(page.locator('text=/Saved/i')).toBeVisible({ timeout: 5000 });

      expect(saveRequests.length).toBeGreaterThan(0);
      const lastSave = saveRequests[saveRequests.length - 1];
      expect(lastSave.sectionType).toBe('address_history');
      expect(Array.isArray(lastSave.entries)).toBe(true);
      expect(lastSave).toHaveProperty('aggregatedFields');
    });

    test('Saved address data loads correctly on return visit', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #18
      const testToken = 'test-record-package-token';

      // First visit — fill and save
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await page.locator('select[name="country"]').first().selectOption({ index: 1 });
      await page.locator('input[name="street1"]').first().fill('999 Persistence Way');
      await page.keyboard.press('Tab');
      await expect(page.locator('text=/Saved/i')).toBeVisible({ timeout: 5000 });

      // Reload — saved data must populate
      await page.reload();
      await page.waitForURL(`**/candidate/${testToken}/portal`);
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      await expect(page.locator('input[name="street1"]').first()).toHaveValue('999 Persistence Way');
    });
  });

  // -------------------------------------------------------------------------
  // Subdivisions API security
  // -------------------------------------------------------------------------

  test.describe('Subdivisions API Security', () => {
    test('Subdivisions endpoint returns 401 without a candidate session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #20 — 401 (no session)
      const testToken = 'test-record-package-token';
      const someParentId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/subdivisions?parentId=${someParentId}`
      );
      expect(response.status()).toBe(401);
    });

    test('Subdivisions endpoint returns 403 when token does not match the candidate session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #20 — 403 (token mismatch)
      const testToken = 'test-record-package-token';
      const wrongToken = 'wrong-token-456';
      const someParentId = '550e8400-e29b-41d4-a716-446655440000';

      // Login with one token
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Call subdivisions endpoint with a different token
      const response = await page.request.get(
        `/api/candidate/application/${wrongToken}/subdivisions?parentId=${someParentId}`
      );
      expect(response.status()).toBe(403);
    });

    test('Subdivisions endpoint returns 400 when parentId is missing', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec technical plan — Validation order 401 → 403 → 400 → 404 → 410
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/subdivisions`
      );
      expect(response.status()).toBe(400);
    });

    test('Subdivisions endpoint returns 400 when parentId is not a valid UUID', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/subdivisions?parentId=not-a-uuid`
      );
      expect(response.status()).toBe(400);
    });

    test('Subdivisions endpoint returns 410 when invitation token has expired', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #20 — 410 (expired token)
      const expiredToken = 'test-expired-token-789';
      const someParentId = '550e8400-e29b-41d4-a716-446655440000';

      await page.goto(`/candidate/${expiredToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${expiredToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${expiredToken}/subdivisions?parentId=${someParentId}`
      );
      expect(response.status()).toBe(410);
    });

    test('Subdivisions endpoint returns 200 with sorted array on success', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #19
      const testToken = 'test-record-package-token';
      // The implementer's seed data should have a country whose UUID is known to the test fixtures.
      const knownCountryId = 'test-known-country-uuid';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/subdivisions?parentId=${knownCountryId}`
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);

      if (data.length > 1) {
        // Verify alphabetical sort order by name
        for (let i = 1; i < data.length; i++) {
          expect(data[i].name >= data[i - 1].name).toBe(true);
        }
        // Verify shape of items
        const first = data[0];
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('code2');
      }
    });

    test('Subdivisions endpoint returns empty array (200) when parent has no children', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec User flow: "subdivisions API may return an empty list"
      const testToken = 'test-record-package-token';
      const leafLocationId = 'test-leaf-location-uuid';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/subdivisions?parentId=${leafLocationId}`
      );
      // Should be 200 with [], not 404
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Fields API extension — subregionId support
  // -------------------------------------------------------------------------

  test.describe('Fields API extension (subregionId)', () => {
    test('Fields API still works without subregionId (backwards compatible)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #11
      const testToken = 'test-record-package-token';
      const knownServiceId = 'test-known-service-uuid';
      const knownCountryId = 'test-known-country-uuid';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/fields?serviceId=${knownServiceId}&countryId=${knownCountryId}`
      );
      expect(response.status()).toBe(200);
    });

    test('Fields API accepts optional subregionId parameter', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #21
      const testToken = 'test-record-package-token';
      const knownServiceId = 'test-known-service-uuid';
      const knownCountryId = 'test-known-country-uuid';
      const knownSubregionId = 'test-known-subregion-uuid';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/fields?serviceId=${knownServiceId}&countryId=${knownCountryId}&subregionId=${knownSubregionId}`
      );
      expect(response.status()).toBe(200);
    });

    test('Fields API returns 400 when subregionId is malformed', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-record-package-token';
      const knownServiceId = 'test-known-service-uuid';
      const knownCountryId = 'test-known-country-uuid';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/fields?serviceId=${knownServiceId}&countryId=${knownCountryId}&subregionId=not-a-uuid`
      );
      expect(response.status()).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Scope endpoint extension — record functionality type
  // -------------------------------------------------------------------------

  test.describe('Scope endpoint extension (record functionality type)', () => {
    test('Scope endpoint accepts functionalityType=record (Stage 3 extension)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec — scope endpoint extension for Address History
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/scope?functionalityType=record`
      );
      expect(response.status()).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Structure endpoint — Address History at position 2 with serviceIds
  // -------------------------------------------------------------------------

  test.describe('Structure endpoint — Address History wiring', () => {
    test('Structure endpoint emits address_history section type at position 2 with serviceIds', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #11 and Business Rule #27
      const testToken = 'test-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/structure`
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('sections');
      expect(Array.isArray(data.sections)).toBe(true);

      const addressHistory = data.sections.find(
        (s: { type: string }) => s.type === 'address_history'
      );
      expect(addressHistory).toBeTruthy();
      expect(addressHistory.functionalityType).toBe('record');
      expect(Array.isArray(addressHistory.serviceIds)).toBe(true);
      expect(addressHistory.serviceIds.length).toBeGreaterThan(0);

      // Verify it appears at index 2 in the service section ordering
      // (after Personal Info and IDV)
      const serviceSectionIndex = data.sections.findIndex(
        (s: { type: string }) => s.type === 'address_history'
      );
      expect(serviceSectionIndex).toBe(2);
    });

    test('Structure endpoint omits address_history when package has no record-type services', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule #1
      const testToken = 'test-no-record-package-token';

      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      const response = await page.request.get(
        `/api/candidate/application/${testToken}/structure`
      );
      expect(response.status()).toBe(200);

      const data = await response.json();
      const addressHistory = data.sections.find(
        (s: { type: string }) => s.type === 'address_history'
      );
      expect(addressHistory).toBeUndefined();
    });
  });
});
