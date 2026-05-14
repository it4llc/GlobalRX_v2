// /GlobalRX_v2/e2e/tests/task-8.4-record-search.spec.ts
// Pass 1 End-to-end tests for Task 8.4 — Record Search Requirements
// (Split from Address History).
// Plan: docs/plans/task-8.4-record-search-requirements-technical-plan.md
//
// These tests describe candidate-facing behaviour for the new Record Search
// Requirements section that splits the aggregated-requirements block out of
// Address History into its own Step 7 in the Task 8.2 nine-step flow.
//
// Sidebar position rules (plan §4.1, §4.2):
//   - "Record Search Requirements" appears in the sidebar AFTER Personal
//     Info and BEFORE any after-services workflow sections.
//   - The section is only present when the package contains at least one
//     record-type service.
//
// Behaviour rules:
//   - Address History no longer renders the aggregated requirements block
//     (plan §4.4).
//   - The empty-state message appears when no aggregated items exist (plan
//     §3.1 — uses translation key candidate.recordSearch.noFieldsRequired).
//   - Auto-save POSTs to the existing save endpoint with sectionType
//     'record_search' (plan §5.1).
//
// All tests below are written BEFORE the implementer builds the feature, so
// every assertion is expected to FAIL on first run (RED phase of TDD). The
// implementer makes them pass. Token + password placeholders match the
// conventions already used in candidate-portal-shell.spec.ts,
// linear-step-navigation.spec.ts, and personal-info-dynamic.spec.ts.

import { test, expect } from '@playwright/test';

const PORTAL_PASSWORD = 'TestPassword123!';

/**
 * Token covering the full 9-step package whose package contains at least
 * one record-type service AND whose country selections require at least
 * one aggregated field (per_search or per_order) on Record Search.
 *
 * For the Record Search section to render its content (rather than the
 * empty-state), the candidate must have already saved at least one
 * Address History entry with a country whose record-type DSX requirements
 * include non-address-block additional fields.
 */
const FULL_PACKAGE_TOKEN = 'test-valid-token-123';

/**
 * Token whose package contains record-type services but whose Address
 * History entries select countries that contribute NO aggregated fields.
 * Used to assert the empty-state message + complete status (plan §3.1).
 */
const NO_AGGREGATED_FIELDS_TOKEN = 'test-no-record-search-fields-token';

/**
 * Token whose package contains NO record-type services. Used to assert
 * that the Record Search section is omitted from the structure entirely
 * (plan §4.1 — guarded by servicesByType.has('record')).
 */
const NO_RECORD_SERVICES_TOKEN = 'test-no-record-services-token';

/**
 * Helper that logs the candidate in via the password form and waits for
 * the portal URL. Matches the pattern in personal-info-dynamic.spec.ts.
 */
async function loginToPortal(page: import('@playwright/test').Page, token: string) {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

/**
 * Helper that navigates to the Record Search Requirements section by
 * clicking its sidebar entry.
 */
async function gotoRecordSearch(page: import('@playwright/test').Page) {
  const recordSearchEntry = page
    .locator('[data-testid="section-item"]')
    .filter({ hasText: /Record Search Requirements/i })
    .first();
  await recordSearchEntry.click();
  await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
}

/**
 * Helper that returns the visible sidebar entries (excluding Review & Submit
 * if rendered with a separate testid). Order in the DOM is the order
 * returned by the structure endpoint.
 */
function getSections(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="section-item"]');
}

test.describe('Task 8.4 — Record Search Requirements — E2E Tests', () => {

  test.describe('Sidebar position — Record Search lives between Personal Info and after-services', () => {
    test('Record Search Requirements appears in the sidebar when the package has record services', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.1 / §5.3: the structure endpoint emits the record_search
      // section when servicesByType.has('record').

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = getSections(page);
      const recordSearchEntry = sections.filter({ hasText: /Record Search Requirements/i });
      await expect(recordSearchEntry).toHaveCount(1);
    });

    test('Record Search Requirements is positioned AFTER Personal Info in the sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.1: insert the new record_search section after the
      // personal_info push and before the after-services workflow push.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = getSections(page);

      const personalInfoIndex = await sections
        .filter({ hasText: /Personal Info/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });

      const recordSearchIndex = await sections
        .filter({ hasText: /Record Search Requirements/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });

      expect(personalInfoIndex).toBeGreaterThanOrEqual(0);
      expect(recordSearchIndex).toBeGreaterThan(personalInfoIndex);
    });

    test('Record Search Requirements is positioned BEFORE Review & Submit', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.1: record_search is inserted before the final review_submit
      // entry (which the structure builder always pushes last).

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const recordSearchIndex = await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Record Search Requirements/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"], [data-testid="review-submit-item"]'));
          return all.indexOf(el as Element);
        });

      const reviewSubmitIndex = await page
        .locator('[data-testid="section-item"], [data-testid="review-submit-item"]')
        .filter({ hasText: /Review/i })
        .last()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"], [data-testid="review-submit-item"]'));
          return all.indexOf(el as Element);
        });

      expect(recordSearchIndex).toBeGreaterThanOrEqual(0);
      expect(reviewSubmitIndex).toBeGreaterThan(recordSearchIndex);
    });

    test('Record Search Requirements is NOT in the sidebar when the package has no record services', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.1: the structure endpoint omits the section entirely when
      // servicesByType.has('record') is false.

      await loginToPortal(page, NO_RECORD_SERVICES_TOKEN);

      const recordSearchEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Record Search Requirements/i });
      await expect(recordSearchEntry).toHaveCount(0);
    });
  });

  test.describe('Record Search content area', () => {
    test('clicking Record Search Requirements shows its heading', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §8.1: RecordSearchSection renders the heading from
      // t('candidate.recordSearch.heading').

      await loginToPortal(page, FULL_PACKAGE_TOKEN);
      await gotoRecordSearch(page);

      // The visible heading text comes from the en-US translation:
      // "Additional information needed for your records search".
      await expect(
        page.getByRole('heading', { name: /Additional information needed for your records search/i }),
      ).toBeVisible();
    });

    test('empty-state message renders when no aggregated items exist', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §3.1, §8.1: when aggregatedItems.length === 0, render the
      // en-US message "No additional information is required for the
      // records search." and report status 'complete'.

      await loginToPortal(page, NO_AGGREGATED_FIELDS_TOKEN);
      await gotoRecordSearch(page);

      await expect(
        page.getByText(/No additional information is required for the records search\./i),
      ).toBeVisible();
    });

    test('Record Search Requirements step renders the shared step-navigation container', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.6: the dispatch branch wraps RecordSearchSection in the
      // standard step-navigation layout (Next / Back buttons), matching
      // every other non-review step (Task 8.2 contract).

      await loginToPortal(page, FULL_PACKAGE_TOKEN);
      await gotoRecordSearch(page);

      await expect(page.locator('[data-testid="step-navigation"]')).toBeVisible();
    });
  });

  test.describe('Address History no longer renders the aggregated requirements block', () => {
    test('Address History does NOT render the aggregated requirements heading or any aggregated-field inputs', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.4: delete the AggregatedRequirements JSX block from
      // AddressHistorySection. After Task 8.4, Address History is
      // entries-only.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const addressHistoryEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Address History/i })
        .first();
      await addressHistoryEntry.click();
      await expect(addressHistoryEntry).toHaveAttribute('data-active', 'true');

      // The aggregated-requirements heading text used by the (now-removed)
      // block was the Record Search heading. After the split, Address
      // History must not render that heading on its own page.
      await expect(
        page.getByRole('heading', { name: /Additional information needed for your records search/i }),
      ).toHaveCount(0);

      // No data-testid uniquely tied to AggregatedRequirements should be
      // present on the Address History page anymore.
      await expect(page.locator('[data-testid="aggregated-requirements"]')).toHaveCount(0);
    });
  });

  test.describe('Record Search is reachable via Next/Back navigation from neighbouring steps', () => {
    test('pressing Next on Personal Info advances to Record Search Requirements (when record services exist)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.1 + Task 8.2 navigation: Next on Personal Info lands on
      // Record Search Requirements when the package has record-type
      // services.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Click Personal Info.
      const personalInfoEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Personal Info/i })
        .first();
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      // Click Next.
      await page.locator('[data-testid="step-nav-next"]').click();

      // The new active section must be Record Search Requirements.
      const recordSearchEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Record Search Requirements/i })
        .first();
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
    });

    test('pressing Back on Record Search returns to Personal Info', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Inverse of the previous test.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);
      await gotoRecordSearch(page);

      await page.locator('[data-testid="step-nav-back"]').click();

      const personalInfoEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Personal Info/i })
        .first();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');
    });
  });

  test.describe('Save behaviour — Record Search posts to /save with sectionType "record_search"', () => {
    test('the network request fired when editing a Record Search field uses sectionType "record_search"', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §5.1: auto-save body shape is
      //   { sectionType: 'record_search', sectionId: 'record_search', fieldValues: {...} }.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);
      await gotoRecordSearch(page);

      // Watch for the save POST. The route is the existing one:
      //   POST /api/candidate/application/[token]/save
      const savePromise = page.waitForRequest((request) => {
        if (request.method() !== 'POST') return false;
        if (!request.url().includes('/api/candidate/application/') || !request.url().endsWith('/save')) {
          return false;
        }
        const body = request.postData() || '';
        return body.includes('"sectionType":"record_search"');
      });

      // Type into the first visible input in the Record Search area, then
      // blur to trigger auto-save (matches the address-history pattern).
      const firstInput = page.locator('input[type="text"], input:not([type])').first();
      await firstInput.fill('Test answer for record search');
      await firstInput.blur();

      const saveRequest = await savePromise;
      const body = saveRequest.postData() || '';
      expect(body).toContain('"sectionType":"record_search"');
      expect(body).toContain('"sectionId":"record_search"');
      expect(body).toContain('"fieldValues"');
    });

    test('the Record Search save request must NOT include an "aggregatedFields" key', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §11.1: no backward-compat reads / writes. The new section
      // never touches address_history.aggregatedFields.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);
      await gotoRecordSearch(page);

      const savePromise = page.waitForRequest((request) => {
        if (request.method() !== 'POST') return false;
        if (!request.url().includes('/api/candidate/application/') || !request.url().endsWith('/save')) {
          return false;
        }
        const body = request.postData() || '';
        return body.includes('"sectionType":"record_search"');
      });

      const firstInput = page.locator('input[type="text"], input:not([type])').first();
      await firstInput.fill('Some value');
      await firstInput.blur();

      const saveRequest = await savePromise;
      const body = saveRequest.postData() || '';
      expect(body).not.toContain('aggregatedFields');
    });
  });

  test.describe('Address History save body no longer carries aggregatedFields', () => {
    test('an Address History save fired by the candidate does NOT include aggregatedFields', async ({ page }) => {
      // THIS TEST WILL FAIL — feature doesn't exist yet.
      // Plan §4.4 point 6: remove `aggregatedFields: aggregatedFieldValues`
      // from the saveEntries POST body. The new Address History payload is
      //   { sectionType: 'address_history', sectionId: 'address_history', entries }.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const addressHistoryEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Address History/i })
        .first();
      await addressHistoryEntry.click();
      await expect(addressHistoryEntry).toHaveAttribute('data-active', 'true');

      const savePromise = page.waitForRequest((request) => {
        if (request.method() !== 'POST') return false;
        if (!request.url().includes('/api/candidate/application/') || !request.url().endsWith('/save')) {
          return false;
        }
        const body = request.postData() || '';
        return body.includes('"sectionType":"address_history"');
      });

      // Trigger a save by editing an entry's text input (the exact input
      // depends on the country's DSX requirements; this picks the first
      // visible input). Blur fires auto-save.
      const firstInput = page.locator('input[type="text"], input:not([type])').first();
      await firstInput.fill('123 Test Street');
      await firstInput.blur();

      const saveRequest = await savePromise;
      const body = saveRequest.postData() || '';
      expect(body).toContain('"sectionType":"address_history"');
      expect(body).not.toContain('aggregatedFields');
    });
  });
});
