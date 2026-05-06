// /GlobalRX_v2/tests/e2e/phase7-stage1-validation-scope-gaps-review.spec.ts
// Pass 1 e2e tests for Phase 7 Stage 1:
// Validation Engine, Scope & Gap Checks, Error Display & Review Page in the
// candidate portal.
//
// These tests will FAIL when first run because the feature does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage of Stage 1 Pass 1 e2e cases (per spec DoD and Edge Cases):
//   - Visit-and-depart triggers field-level errors on a previously visited section
//     (Spec Rules 1, 2, 4 / DoD 3).
//   - Scope shortfall produces a section-level banner (Spec Rule 8 / DoD 7).
//   - Gap detection produces a section-level banner for Address History
//     (Spec Rules 20–24 / DoD 11, 13).
//   - Format error on an optional field with bad-format content (Spec Rule 5 /
//     DoD 4, 5, 6).
//   - Review & Submit page lists errors across sections, Submit button is
//     disabled, static help text reads "Submit will be available once all
//     sections are complete." (Spec Rule 33 / DoD 22).
//   - Visiting Review & Submit triggers error display for sections on subsequent
//     visits, even sections never visited directly (Spec Rules 3, 34 / DoD 23).

import { test, expect } from '@playwright/test';

// Test fixtures — the implementer is responsible for seeding these tokens
// against candidate invitations that expose the relevant package shape.
//
// Each token's package and saved-data are summarized inline in the test that
// uses it so the implementer can match the seed to the assertion.
const TOKEN_VALIDATION_BASE = 'test-stage7-1-validation-base';
const TOKEN_SCOPE_SHORTFALL = 'test-stage7-1-scope-shortfall';
const TOKEN_ADDRESS_GAP = 'test-stage7-1-address-gap';
const TOKEN_OPTIONAL_FORMAT_ERROR = 'test-stage7-1-optional-format';
const TOKEN_REVIEW_PAGE = 'test-stage7-1-review-page';
const TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED = 'test-stage7-1-review-all-red';

const CANDIDATE_PASSWORD = 'TestPassword123!';

async function loginAsCandidate(
  page: import('@playwright/test').Page,
  token: string
): Promise<void> {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

test.describe('Phase 7 Stage 1 — Validation, Scope & Gap Checks, Review Page', () => {

  // -----------------------------------------------------------------------
  // Section visit tracking and field-level errors (Rules 1, 2, 4 / DoD 3)
  // -----------------------------------------------------------------------

  test.describe('Section Visit Tracking and Field-Level Errors', () => {
    test('field-level errors do not appear on a section the candidate is still working in', async ({ page }) => {
      // Spec Rules 1, 4 — errors must NOT show before first visit+departure.
      await loginAsCandidate(page, TOKEN_VALIDATION_BASE);

      // Click into Personal Information for the first time.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' })
        .click();

      // No field-error message should be visible yet — the candidate has not
      // departed the section.
      const fieldErrors = page.locator('[data-testid="field-error-message"]');
      await expect(fieldErrors).toHaveCount(0);
    });

    test('after visiting and departing a section with empty required fields, red borders + messages appear when the candidate returns', async ({ page }) => {
      // Spec Rules 1, 2, 4, 6 / DoD 3
      await loginAsCandidate(page, TOKEN_VALIDATION_BASE);

      // Step 1: Visit Personal Information without filling required fields.
      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });
      await personalInfoRow.click();

      // Step 2: Depart by clicking another section in the sidebar.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Step 3: Sidebar indicator on Personal Information should now be red
      // (incomplete) per the updated progress logic (Rule 27).
      const personalInfoIndicator = personalInfoRow.locator(
        '[data-testid="section-progress-indicator"]'
      );
      await expect(personalInfoIndicator).toHaveAttribute(
        'data-status',
        'incomplete'
      );

      // Step 4: Return to Personal Information.
      await personalInfoRow.click();

      // Step 5: Field-level error messages on at least one required field appear
      // immediately (Rule 6 — they do not wait for another departure).
      const fieldErrors = page.locator('[data-testid="field-error-message"]');
      await expect(fieldErrors.first()).toBeVisible();
    });

    test('filling in a required field and tabbing away clears its red border on the next auto-save', async ({ page }) => {
      // Spec Rule 7 / DoD 6
      await loginAsCandidate(page, TOKEN_VALIDATION_BASE);

      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });

      // Visit, depart, return — so errors show.
      await personalInfoRow.click();
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();
      await personalInfoRow.click();

      // First Name should have an error before fill.
      const firstNameField = page.locator('input[name="firstName"]');
      const firstNameError = page
        .locator('[data-testid="field-error-message"]')
        .filter({ hasText: /first name|required/i })
        .first();

      await expect(firstNameError).toBeVisible();

      // Fill in and trigger auto-save by blurring.
      await firstNameField.fill('Jane');
      await firstNameField.blur();

      // Error message should disappear.
      await expect(firstNameError).toBeHidden();
    });
  });

  // -----------------------------------------------------------------------
  // Scope shortfall — section banner (Rules 8, 9, 12, 19 / DoD 7, 8, 9)
  // -----------------------------------------------------------------------

  test.describe('Scope Shortfall Banner', () => {
    test('a scope shortfall on Education History (e.g. "most-recent-2" with 1 entry) shows a banner after section departure', async ({ page }) => {
      // Spec Rule 8, Rule 9 (example "2 education entries are required. You currently have 1.")
      // DoD 7, DoD 9 (count_specific scope validation)
      await loginAsCandidate(page, TOKEN_SCOPE_SHORTFALL);

      // Step 1: Visit Education History.
      const educationRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' });
      await educationRow.click();

      // Add only ONE entry, then depart. (Seed expects scope = most-recent-2.)
      // The "Add Entry" button creates the first entry; the seed may already
      // provide it. Implementer chooses initial state; either way only 1 entry
      // exists at departure time.
      const addEntryButton = page.locator('[data-testid="add-entry-button"]');
      const entryCount = await page
        .locator('[data-testid="repeatable-entry"]')
        .count();
      if (entryCount === 0) {
        await addEntryButton.click();
      }

      // Step 2: Depart by clicking another section.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' })
        .click();

      // Step 3: Return to Education History.
      await educationRow.click();

      // Step 4: The scope banner should be visible at the top of the section.
      const banner = page.locator('[data-testid="section-error-banner"]');
      await expect(banner).toBeVisible();
      // Per Spec Rule 9 / Tech plan 8.2 — banner content uses the
      // candidate.validation.scope.* translation keys with placeholders for
      // {required} and {actual}. The rendered text MUST include both the
      // required count and the actual count.
      await expect(banner).toContainText(/2/);
      await expect(banner).toContainText(/1/);
    });

    test('a multi-entry section visited with zero entries shows the "0 entered" banner and turns red (Rule 12 / DoD 8)', async ({ page }) => {
      // Spec Rule 12 / DoD 8 — multi-entry section with zero entries after
      // visit-and-depart shows the "X entries required, 0 entered" banner.
      await loginAsCandidate(page, TOKEN_SCOPE_SHORTFALL);

      const employmentRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Employment History' });
      await employmentRow.click();

      // Do NOT add any entries.
      // Depart.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' })
        .click();

      // Sidebar indicator turns red.
      const employmentIndicator = employmentRow.locator(
        '[data-testid="section-progress-indicator"]'
      );
      await expect(employmentIndicator).toHaveAttribute(
        'data-status',
        'incomplete'
      );

      // Returning to Employment History — banner shows "0 entered".
      await employmentRow.click();
      const banner = page.locator('[data-testid="section-error-banner"]');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(/0/);
    });
  });

  // -----------------------------------------------------------------------
  // Gap detection — banner (Rules 20–24 / DoD 11, 13)
  // -----------------------------------------------------------------------

  test.describe('Gap Detection', () => {
    test('an unaccounted gap in Address History produces a banner after section departure', async ({ page }) => {
      // Spec Rules 20–24 / Edge Case (the spec's banner example: "There is a
      // gap in your employment history from March 2023 to June 2023 (3 months).")
      // DoD 11, DoD 13
      // Token: gapToleranceDays is set to 30 in the seeded workflow; saved data
      // contains two address entries with a multi-month gap inside the scope
      // period.
      await loginAsCandidate(page, TOKEN_ADDRESS_GAP);

      const addressRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' });
      await addressRow.click();

      // Depart.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' })
        .click();

      // Return.
      await addressRow.click();

      // Banner is visible and includes a gap message.
      const banner = page.locator('[data-testid="section-error-banner"]');
      await expect(banner).toBeVisible();
      // Gap messages explicitly include the gap duration (e.g., "3 months"
      // or a day count). Either format must include a number that makes the
      // gap concrete to the candidate.
      await expect(banner).toContainText(/gap/i);
    });
  });

  // -----------------------------------------------------------------------
  // Format error on optional field with content (Rule 5 / DoD 4, 5)
  // -----------------------------------------------------------------------

  test.describe('Optional Field Format Errors', () => {
    test('an optional email field with bad-format content shows a format-specific error after section departure', async ({ page }) => {
      // Spec Rule 5 / DoD 4 — optional fields with bad-format content show red
      // borders and format-specific messages after the section is departed.
      // The seed supplies a saved value of "not-an-email" in an optional
      // email-typed field.
      await loginAsCandidate(page, TOKEN_OPTIONAL_FORMAT_ERROR);

      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });
      await personalInfoRow.click();

      // Depart.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Return.
      await personalInfoRow.click();

      // The format error is visible on the optional email field.
      const formatErrors = page.locator('[data-testid="field-error-message"]');
      await expect(formatErrors.first()).toBeVisible();
      // The English translation of candidate.validation.format.email reads
      // "Please enter a valid email address." Checking on a substring keeps
      // the assertion resilient to copy tweaks.
      await expect(formatErrors.first()).toContainText(/email/i);
    });

    test('an empty optional field NEVER shows an error (Rule 5 / DoD 5)', async ({ page }) => {
      // The seed for the same token must include another optional field that is
      // EMPTY (no saved value). After visit-and-depart, that empty optional
      // field MUST NOT show an error.
      await loginAsCandidate(page, TOKEN_OPTIONAL_FORMAT_ERROR);

      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });
      await personalInfoRow.click();
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();
      await personalInfoRow.click();

      // The "phone-optional" field (or similar — implementer's seed picks the
      // optional field) is empty and must NOT have an error attached.
      const emptyOptional = page.locator(
        '[data-testid="field-error-message"][data-field="phoneOptional"]'
      );
      await expect(emptyOptional).toHaveCount(0);
    });
  });

  // -----------------------------------------------------------------------
  // Review & Submit page (Rules 29–34 / DoD 19–23)
  // -----------------------------------------------------------------------

  test.describe('Review & Submit Page', () => {
    test('Review & Submit appears as the last entry in the sidebar', async ({ page }) => {
      // Spec Rule 29 / DoD 19 — a new page accessed from the bottom of the
      // sidebar, positioned last after all workflow after-services sections.
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE);

      const sectionItems = page.locator('[data-testid="section-item"]');
      const allTexts = await sectionItems.allTextContents();

      const reviewIdx = allTexts.findIndex((t) => /Review.*Submit/i.test(t));
      expect(reviewIdx).toBeGreaterThanOrEqual(0);
      // It must be the last entry.
      expect(reviewIdx).toBe(allTexts.length - 1);
    });

    test('Submit button on Review & Submit is visible, disabled, with the static help text exactly per Rule 33 / DoD 22', async ({ page }) => {
      // Spec Rule 33 / DoD 22 — Submit button is disabled, with help text
      // "Submit will be available once all sections are complete." regardless
      // of remaining errors. No tooltip (mobile has no hover).
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE);

      // Click into Review & Submit.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // Submit button visible and disabled.
      const submitButton = page.getByRole('button', { name: 'Submit' });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeDisabled();

      // Help text below the button reads exactly the spec wording.
      const helpText = page.locator(
        '[data-testid="review-submit-help-text"]'
      );
      await expect(helpText).toBeVisible();
      await expect(helpText).toHaveText(
        'Submit will be available once all sections are complete.'
      );
    });

    test('Review & Submit shows errors for ALL sections regardless of visit status (Rule 32 / DoD 21)', async ({ page }) => {
      // Spec Rule 32 / DoD 21 — Review & Submit shows errors for ALL sections,
      // even sections the candidate hasn't visited yet.
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED);

      // Without visiting any section, go straight to Review & Submit.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // Each unfinished section (per the seed: at least 2 with errors) is
      // listed with its name and at least one error.
      const sectionBlocks = page.locator(
        '[data-testid="review-section-block"]'
      );
      const count = await sectionBlocks.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // At least one error item is rendered.
      const errorItems = page.locator(
        '[data-testid="review-error-item"]'
      );
      expect(await errorItems.count()).toBeGreaterThan(0);
    });

    test('tapping an error on Review & Submit navigates to the relevant section (Rule 31 / DoD 20)', async ({ page }) => {
      // Spec Rule 31 / DoD 20 — each error message is tappable; tapping it
      // navigates the candidate to the relevant section.
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // Tap the first error item.
      const firstError = page.locator('[data-testid="review-error-item"]').first();
      await firstError.click();

      // The portal layout should now show a non-Review section (i.e., the user
      // is taken away from Review & Submit and into the section with the error).
      // The Review & Submit page-level container should no longer be visible.
      const reviewPage = page.locator(
        '[data-testid="review-submit-page"]'
      );
      await expect(reviewPage).toBeHidden();
    });

    test('visiting Review & Submit causes ALL sections to show their errors on subsequent visits, even ones never visited directly (Rules 3, 34 / DoD 23)', async ({ page }) => {
      // Spec Rules 3, 34 / DoD 23 — visiting Review & Submit triggers error
      // display for all sections on subsequent navigation, permanently.
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED);

      // Step 1: Visit Review & Submit (sets reviewPageVisitedAt).
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // Step 2: Navigate back to a section the candidate has NEVER visited.
      // Pick Address History — under this seed it has scope errors.
      const addressRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' });
      await addressRow.click();

      // Step 3: Banner / field errors should be visible immediately, even
      // though the candidate never directly visited and departed Address
      // History (the Review & Submit visit is the trigger).
      const banner = page.locator('[data-testid="section-error-banner"]');
      await expect(banner).toBeVisible();
    });

    test('the reviewPageVisitedAt flag persists across reload (Spec Rule 3 / Edge Case 8)', async ({ page }) => {
      // Spec Rule 3 / Edge Case 8 — `reviewPageVisitedAt` flag persists. All
      // sections continue to show their errors from that point on. The flag
      // never resets.
      await loginAsCandidate(page, TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED);

      // Visit Review & Submit.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // Reload the page (simulating browser close+reopen would also work).
      await page.reload();
      await page.waitForURL(`**/candidate/${TOKEN_REVIEW_PAGE_ALL_SECTIONS_RED}/portal`);

      // Visit a section the candidate has never visited.
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Banner should still be visible (flag persisted across reload).
      const banner = page.locator('[data-testid="section-error-banner"]');
      await expect(banner).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Mobile (Spec UI Components — Mobile Navigation / DoD 28, 29)
  // -----------------------------------------------------------------------

  test.describe('Mobile Navigation', () => {
    test('the Review & Submit entry is reachable from the mobile menu and the help text is visible on mobile', async ({ page }) => {
      // Spec UI Components — Mobile Navigation / DoD 29
      await page.setViewportSize({ width: 375, height: 667 });

      await loginAsCandidate(page, TOKEN_REVIEW_PAGE);

      // Open the mobile menu.
      await page.locator('[data-testid="hamburger-menu"]').click();

      // Tap the Review & Submit entry.
      await page
        .locator('[data-testid="mobile-menu"]')
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Review.*Submit/i })
        .click();

      // The static help text below the disabled Submit button is visible at
      // mobile width.
      const helpText = page.locator(
        '[data-testid="review-submit-help-text"]'
      );
      await expect(helpText).toBeVisible();
      await expect(helpText).toHaveText(
        'Submit will be available once all sections are complete.'
      );
    });
  });
});
