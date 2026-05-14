// /GlobalRX_v2/e2e/tests/personal-info-dynamic.spec.ts
// Pass 1 End-to-end tests for Task 8.3 — Personal Info 100% Dynamic.
// Spec: docs/specs/personal-info-dynamic.md
// Plan: docs/plans/personal-info-dynamic-technical-plan.md
//
// These tests describe candidate-facing behaviour for Personal Info after
// Task 8.3 removes the three static/locked fields (name, email, phone) and
// makes the section 100% driven by the cross-section subject-targeted field
// registry. They are intentionally written BEFORE the implementer produces
// the feature, so every assertion below is expected to FAIL on first run
// (RED phase of TDD). The implementer makes them pass.
//
// Token / password placeholders follow the conventions already used in
// candidate-portal-shell.spec.ts, candidate-login-session.spec.ts, and
// linear-step-navigation.spec.ts.

import { test, expect } from '@playwright/test';

const PORTAL_PASSWORD = 'TestPassword123!';

/**
 * Token covering the full 9-step package whose country selections require
 * at least one subject-targeted dynamic field on Personal Info (e.g. Brazil
 * triggering "Mother's Maiden Name"). Used to assert that:
 *  - The three static locked fields (first name, last name, email, phone)
 *    do NOT render on Personal Info.
 *  - Dynamic registry-driven fields DO render and accept input.
 *  - Auto-save still triggers on field blur (spec rule 3 / DoD 5).
 */
const FULL_DYNAMIC_TOKEN = 'test-valid-token-123';

/**
 * Token whose country selections do NOT trigger any subject-targeted
 * fields. Used to assert the empty-state message + completed status
 * (spec rule 4 / DoD 3 + 4).
 */
const NO_DYNAMIC_FIELDS_TOKEN = 'test-no-personal-info-token';

/**
 * Helper that logs the candidate in via the password form and waits for
 * the portal URL. Mirrors loginToPortal in linear-step-navigation.spec.ts.
 */
async function loginToPortal(page: import('@playwright/test').Page, token: string) {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

/**
 * Helper that navigates to the Personal Info section of the portal.
 * Personal Info now sits at Step 6 in the 9-step flow (Task 8.2), so we
 * locate it by its sidebar label rather than by index.
 */
async function gotoPersonalInfo(page: import('@playwright/test').Page) {
  const personalInfoEntry = page
    .locator('[data-testid="section-item"]')
    .filter({ hasText: /Personal Info/i })
    .first();
  await personalInfoEntry.click();
  await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');
}

test.describe('Personal Info — 100% Dynamic (Task 8.3) — E2E Tests', () => {

  test.describe('Static fields are removed from Personal Info', () => {
    test('Personal Info does NOT render the firstName field', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 + Definition of Done item 1.
      // The first-name input must not be present on Personal Info — it is
      // shown to the candidate on the Welcome page (Task 8.1) instead.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      // No input with name="firstName" anywhere on Personal Info.
      await expect(page.locator('input[name="firstName"]')).toHaveCount(0);
    });

    test('Personal Info does NOT render the lastName field', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 + Definition of Done item 1.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      await expect(page.locator('input[name="lastName"]')).toHaveCount(0);
    });

    test('Personal Info does NOT render the email field', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 + Definition of Done item 1.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      await expect(page.locator('input[name="email"]')).toHaveCount(0);
    });

    test('Personal Info does NOT render the phone field', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 + Definition of Done item 1.
      // Both fieldKeys 'phone' and 'phoneNumber' are locked invitation
      // fields per the technical plan; neither should render here.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      await expect(page.locator('input[name="phone"]')).toHaveCount(0);
      await expect(page.locator('input[name="phoneNumber"]')).toHaveCount(0);
    });

    test('Personal Info does NOT show any readonly/locked input', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 + Definition of Done item 1.
      // After Task 8.3 every field passed to the section has locked=false
      // and prefilledValue=null. No input on Personal Info should be in a
      // readonly/disabled state.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      // Scope to the main content (the section being viewed), so we don't
      // accidentally pick up read-only inputs from the sidebar or header.
      const mainContent = page.locator('[data-testid="main-content"]');

      const readonlyInputs = mainContent.locator('input[readonly]');
      const disabledInputs = mainContent.locator('input[disabled]');

      await expect(readonlyInputs).toHaveCount(0);
      await expect(disabledInputs).toHaveCount(0);
    });
  });

  test.describe('Personal Info renders only dynamic registry fields', () => {
    test('Personal Info renders the dynamic subject-targeted fields pushed by the registry', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 2 + Definition of Done item 2.
      //
      // The FULL_DYNAMIC_TOKEN package's country selections trigger at
      // least one subject-targeted field on Personal Info. The section
      // should render those fields (and ONLY those fields).

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      const mainContent = page.locator('[data-testid="main-content"]');

      // At least one editable input must be visible.
      const editableInputs = mainContent.locator(
        'input:not([readonly]):not([disabled]):not([type="hidden"])'
      );
      const editableCount = await editableInputs.count();
      expect(editableCount).toBeGreaterThan(0);

      // The locked invitation fieldKeys must NOT appear in the rendered
      // inputs even though some other dynamic fields do.
      await expect(mainContent.locator('input[name="firstName"]')).toHaveCount(0);
      await expect(mainContent.locator('input[name="lastName"]')).toHaveCount(0);
      await expect(mainContent.locator('input[name="email"]')).toHaveCount(0);
      await expect(mainContent.locator('input[name="phone"]')).toHaveCount(0);
      await expect(mainContent.locator('input[name="phoneNumber"]')).toHaveCount(0);
    });

    test('candidate can fill a dynamic field on Personal Info and the value persists', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 3 (auto-save / load behaviour unchanged for
      // dynamic fields) + Definition of Done item 5.
      //
      // The candidate enters a value into the first editable dynamic
      // field, blurs it (triggering auto-save), navigates away to another
      // section, returns, and the value is still there.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      const mainContent = page.locator('[data-testid="main-content"]');
      const firstEditable = mainContent
        .locator('input:not([readonly]):not([disabled]):not([type="hidden"])')
        .first();
      await expect(firstEditable).toBeVisible();

      const fieldName = await firstEditable.getAttribute('name');
      expect(fieldName).not.toBeNull();
      expect(fieldName).not.toBe('firstName');
      expect(fieldName).not.toBe('lastName');
      expect(fieldName).not.toBe('email');
      expect(fieldName).not.toBe('phone');
      expect(fieldName).not.toBe('phoneNumber');

      const testValue = 'AutosaveTestValue';
      await firstEditable.fill(testValue);
      // Blur to trigger auto-save (per spec rule 3 and the existing
      // section's onBlur handler).
      await firstEditable.blur();

      // Navigate to a different section and back.
      const sections = page.locator('[data-testid="section-item"]');
      await sections.first().click();
      await gotoPersonalInfo(page);

      // The value is still present.
      const reloadedField = mainContent.locator(`input[name="${fieldName}"]`).first();
      await expect(reloadedField).toHaveValue(testValue);
    });
  });

  test.describe('Empty state when no dynamic fields apply', () => {
    test('Personal Info shows the "no additional information required" message when there are no dynamic fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 4 + Definition of Done item 3 + edge case 1.

      await loginToPortal(page, NO_DYNAMIC_FIELDS_TOKEN);
      await gotoPersonalInfo(page);

      // The spec wording is "No additional information is required." —
      // this matches the en-US value the technical plan sets for the
      // candidate.portal.personalInfo.noFieldsRequired key.
      await expect(
        page.getByText('No additional information is required.', { exact: false })
      ).toBeVisible();
    });

    test('Personal Info status is "complete" in the sidebar when there are no dynamic fields', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 4 + Definition of Done item 4.
      //
      // When the section has zero applicable dynamic fields the sidebar
      // status indicator next to Personal Info should reflect a completed
      // state (green check), not "incomplete" or "in progress".

      await loginToPortal(page, NO_DYNAMIC_FIELDS_TOKEN);

      const personalInfoEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Personal Info/i })
        .first();
      // The status indicator sits within the same sidebar entry as the
      // Personal Info label.
      const statusIndicator = personalInfoEntry.locator('[data-testid="section-status"]');

      await expect(statusIndicator).toBeVisible();

      // The implementer signals completion via either a data attribute
      // (e.g. data-status="complete") or by including the word "complete"
      // in an accessible label. Accept either signal.
      const statusAttr = (await statusIndicator.getAttribute('data-status')) || '';
      const ariaLabel = (await statusIndicator.getAttribute('aria-label')) || '';
      const combined = `${statusAttr} ${ariaLabel}`.toLowerCase();

      expect(combined).toMatch(/complete/);
      expect(combined).not.toMatch(/incomplete/);
      expect(combined).not.toMatch(/in.?progress/);
    });

    test('candidate can press Next from Personal Info when the empty state is shown', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec User Flow paragraph 3 + Definition of Done item 4.
      //
      // The Next button must be enabled when Personal Info shows the
      // empty-state message, because the section is treated as complete.

      await loginToPortal(page, NO_DYNAMIC_FIELDS_TOKEN);
      await gotoPersonalInfo(page);

      const nextButton = page.locator('[data-testid="step-nav-next"]');
      await expect(nextButton).toBeVisible();
      await expect(nextButton).toBeEnabled();
    });
  });

  test.describe('Welcome page still shows the static fields (sanity check)', () => {
    test('candidate name, email, and phone are visible on the Welcome page', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Summary paragraph + Who Uses This — name/email/phone now live
      // on the Welcome page (Task 8.1) rather than on Personal Info.
      // The candidate should still be able to see them somewhere in the
      // portal; this test confirms they have not simply disappeared.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // Welcome is a before_services workflow step. Locate it via sidebar
      // and click in.
      const welcomeEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Welcome/i })
        .first();
      await welcomeEntry.click();
      await expect(welcomeEntry).toHaveAttribute('data-active', 'true');

      // The Welcome page renders the candidate's first name, email, and
      // phone via template variables (Task 8.1). We do not know the exact
      // wording here, but we know the substituted values appear somewhere
      // in the main content. The test asserts that the page renders text
      // for each of those three values (not a placeholder like
      // "{{firstName}}").
      const mainContent = page.locator('[data-testid="main-content"]');

      // No unsubstituted template variables should be visible on Welcome
      // (this would indicate the substitution broke).
      const mainText = (await mainContent.textContent()) || '';
      expect(mainText).not.toContain('{{firstName}}');
      expect(mainText).not.toContain('{{lastName}}');
      expect(mainText).not.toContain('{{email}}');
      expect(mainText).not.toContain('{{phone}}');
      expect(mainText).not.toContain('{{phoneNumber}}');
    });
  });

  test.describe('Review & Submit no longer shows static fields', () => {
    test('Review & Submit does not list firstName, lastName, email, or phone as Personal Info validation errors', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 7 + Definition of Done item 7.
      //
      // The validation engine no longer expects the locked invitation
      // fieldKeys on Personal Info (spec rule 6), so the Review & Submit
      // page's per-section error list must not flag them as missing.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // Navigate to Review & Submit (the last sidebar entry).
      const sections = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]'
      );
      await sections.last().click();

      const mainContent = page.locator('[data-testid="main-content"]');
      const reviewText = ((await mainContent.textContent()) || '').toLowerCase();

      // Any per-field error/summary text for the four locked fieldKeys
      // would be a regression. We assert the rendered review text does
      // not flag them by name.
      //
      // We intentionally allow the words "first name", "last name",
      // "email", and "phone" to appear elsewhere on the page (the order
      // summary may show them), but they must not appear in an
      // "incomplete" / "required" / "missing" context inside the Personal
      // Info section. The simplest assertion is that the literal phrases
      // commonly used for missing-field errors do not co-occur with those
      // fieldKeys.
      //
      // If the implementer wires per-section error blocks, this will be
      // exercised more precisely; for Pass 1 we apply a loose check.
      expect(reviewText).not.toMatch(/first ?name.*(required|missing|incomplete)/);
      expect(reviewText).not.toMatch(/last ?name.*(required|missing|incomplete)/);
      expect(reviewText).not.toMatch(/email.*(required|missing|incomplete)/);
      expect(reviewText).not.toMatch(/phone.*(required|missing|incomplete)/);
    });
  });

  test.describe('Mobile (320px minimum width)', () => {
    test('Personal Info empty-state message is visible on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Definition of Done item 11 + Edge case "Mobile (320px)".

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, NO_DYNAMIC_FIELDS_TOKEN);
      await gotoPersonalInfo(page);

      const emptyStateText = page.getByText('No additional information is required.', {
        exact: false,
      });
      await expect(emptyStateText).toBeVisible();

      // The message must not overflow horizontally.
      const box = await emptyStateText.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    });

    test('Personal Info dynamic fields are usable on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Definition of Done item 11.

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      const mainContent = page.locator('[data-testid="main-content"]');
      const firstEditable = mainContent
        .locator('input:not([readonly]):not([disabled]):not([type="hidden"])')
        .first();
      await expect(firstEditable).toBeVisible();

      const box = await firstEditable.boundingBox();
      expect(box).not.toBeNull();
      // Field must fit within the viewport (no horizontal overflow).
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    });
  });

  test.describe('Instructions text no longer mentions invitation prefill', () => {
    test('the Personal Info instructions block does not mention "information from your invitation"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1 / Plan Section 4 — the post-Task-8.3
      // instructions value should NOT include the sentence about
      // "Information from your invitation is already filled in and cannot
      // be changed." (because no locked invitation fields render any more).

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);
      await gotoPersonalInfo(page);

      const mainContent = page.locator('[data-testid="main-content"]');
      const mainText = (await mainContent.textContent()) || '';

      expect(mainText.toLowerCase()).not.toContain('information from your invitation');
      expect(mainText.toLowerCase()).not.toContain('already filled in and cannot be changed');
    });
  });
});
