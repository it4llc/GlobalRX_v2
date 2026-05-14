// /GlobalRX_v2/e2e/tests/silent-recalculation-step-skipping.spec.ts
//
// Pass 1 End-to-end tests for Task 8.5 — Silent Recalculation and Step
// Skipping. These exercise the candidate's full browser experience for the
// three behaviors the spec adds:
//
//   1. Silent recalculation of Personal Info (Step 7) and Record Search
//      Requirements (Step 8) when the candidate arrives at those steps.
//   2. Dynamic step skipping — Step 7 and Step 8 hide from the sidebar and
//      Next/Back navigation when their inputs produce zero items, and
//      reappear when the candidate's entries produce content again.
//   3. Review & Submit accounts for the dynamic step set — skipped steps
//      are absent from the review summary and don't block submission;
//      previously-skipped-now-visible steps that are incomplete DO block
//      submission.
//
// Spec:           docs/specs/silent-recalculation-step-skipping.md
// Technical plan: docs/plans/silent-recalculation-step-skipping-technical-plan.md
//
// These tests are intentionally written BEFORE the implementer produces
// the feature, so every assertion below is expected to FAIL on first run
// (RED phase of TDD). The implementer's job is to make them pass.
//
// Token / password placeholders follow the conventions already used in
// candidate-portal-shell.spec.ts, linear-step-navigation.spec.ts,
// personal-info-dynamic.spec.ts, and task-8.4-record-search.spec.ts.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const PORTAL_PASSWORD = 'TestPassword123!';

/**
 * Token covering a candidate whose package and current entries trigger
 * BOTH dynamic sections — at least one subject-targeted cross-section
 * requirement (Personal Info / Step 7) and at least one aggregated field
 * for record search (Step 8). Used as the baseline for "both steps
 * visible" assertions and for recalculation tests that adjust state.
 */
const FULL_DYNAMIC_TOKEN = 'test-valid-token-123';

/**
 * Token whose package has record-type services but whose current Address
 * History entries select countries that contribute NO subject-targeted
 * fields and NO aggregated fields. Used to assert that BOTH Step 7 and
 * Step 8 are skipped from the sidebar and from Next/Back navigation when
 * neither has content (spec edge case 4).
 */
const NO_DYNAMIC_CONTENT_TOKEN = 'test-no-dynamic-content-token';

/**
 * Token whose Address History entries contribute subject-targeted fields
 * (Personal Info has content) but produce NO aggregated record-search
 * fields. Used to assert that only Step 8 is skipped and that Next from
 * Personal Info goes straight to the after-services workflow (spec edge
 * case 5).
 */
const ONLY_PERSONAL_INFO_TOKEN = 'test-only-personal-info-token';

/**
 * Token whose Address History entries produce aggregated record-search
 * fields but NO subject-targeted Personal Info fields. Used to assert
 * that only Step 7 is skipped and that Next from Employment goes
 * straight to Record Search (spec edge case 5).
 */
const ONLY_RECORD_SEARCH_TOKEN = 'test-only-record-search-token';

/**
 * Helper that logs the candidate in via the password form and waits for
 * the portal URL.
 */
async function loginToPortal(page: Page, token: string) {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

/** Locator for every sidebar section entry (excluding any review-submit-only testid). */
function sections(page: Page) {
  return page.locator('[data-testid="section-item"]');
}

/** Locator for the sidebar entry matching a heading regex (Personal Info / Record Search / …). */
function sectionByText(page: Page, text: RegExp) {
  return sections(page).filter({ hasText: text }).first();
}

/**
 * Returns the DOM index of an element among every section-item /
 * review-submit-item entry in the sidebar. Used to assert relative
 * ordering. -1 means "not present."
 */
async function sidebarIndex(page: Page, text: RegExp): Promise<number> {
  const locator = page
    .locator('[data-testid="section-item"], [data-testid="review-submit-item"]')
    .filter({ hasText: text })
    .first();

  const count = await locator.count();
  if (count === 0) return -1;

  return locator.evaluate((el) => {
    const all = Array.from(
      document.querySelectorAll(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      ),
    );
    return all.indexOf(el as Element);
  });
}

test.describe('Task 8.5 — Silent Recalculation and Step Skipping — E2E Tests', () => {

  // -------------------------------------------------------------------------
  // Sidebar visibility — Step 7 / Step 8 are skipped when their inputs are
  // empty (spec Business Rules 5, 6; Definition of Done 5, 6)
  // -------------------------------------------------------------------------

  test.describe('Sidebar: dynamic steps are hidden when they have no content', () => {
    test('Personal Info AND Record Search are absent from the sidebar when neither has content (spec edge case 4)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rules 5 + 6, Definition of Done 5 + 6, edge case 4.

      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      await expect(
        page.locator('[data-testid="section-item"]').filter({ hasText: /Personal Info/i }),
      ).toHaveCount(0);
      await expect(
        page
          .locator('[data-testid="section-item"]')
          .filter({ hasText: /Record Search Requirements/i }),
      ).toHaveCount(0);
    });

    test('Only Record Search is hidden when Personal Info has content but Record Search does not (spec edge case 5)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 6 + edge case 5.

      await loginToPortal(page, ONLY_PERSONAL_INFO_TOKEN);

      await expect(
        page.locator('[data-testid="section-item"]').filter({ hasText: /Personal Info/i }),
      ).toHaveCount(1);
      await expect(
        page
          .locator('[data-testid="section-item"]')
          .filter({ hasText: /Record Search Requirements/i }),
      ).toHaveCount(0);
    });

    test('Only Personal Info is hidden when Record Search has content but Personal Info does not (spec edge case 5)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 5 + edge case 5.

      await loginToPortal(page, ONLY_RECORD_SEARCH_TOKEN);

      await expect(
        page.locator('[data-testid="section-item"]').filter({ hasText: /Personal Info/i }),
      ).toHaveCount(0);
      await expect(
        page
          .locator('[data-testid="section-item"]')
          .filter({ hasText: /Record Search Requirements/i }),
      ).toHaveCount(1);
    });

    test('Both Personal Info and Record Search appear in the sidebar when each has content', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Baseline check — when both inputs are non-empty, neither step is
      // skipped. Failing here would mean the new filter regressed the
      // existing-visible case.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      await expect(
        page.locator('[data-testid="section-item"]').filter({ hasText: /Personal Info/i }),
      ).toHaveCount(1);
      await expect(
        page
          .locator('[data-testid="section-item"]')
          .filter({ hasText: /Record Search Requirements/i }),
      ).toHaveCount(1);
    });

    test('Sidebar entries do not show step numbers (resolved question 2)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Resolved Question 2: "Sidebar shows step names only, no
      // numbering or total count. This avoids confusion when the total
      // number of visible steps changes dynamically."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const total = await sections(page).count();
      for (let i = 0; i < total; i += 1) {
        const text = ((await sections(page).nth(i).textContent()) || '').trim();
        // Reject "Step N", "N.", "N)" prefixes.
        expect(text).not.toMatch(/^\s*Step\s+\d+/i);
        expect(text).not.toMatch(/^\s*\d+[.)]\s/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Next/Back navigation skips invisible dynamic steps (BR 5, 6 navigation
  // half; DoD 5, 6 navigation half; edge cases 4, 5)
  // -------------------------------------------------------------------------

  test.describe('Next/Back navigation jumps over hidden dynamic steps', () => {
    test('Next from Employment lands on Record Search when Personal Info is skipped but Record Search has content', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec edge case 5: "if Step 7 is skipped but Step 8 has content:
      // Next from Step 6 goes to Step 8." Employment is the last service
      // section before the dynamic steps in this fixture.

      await loginToPortal(page, ONLY_RECORD_SEARCH_TOKEN);

      const employmentEntry = sectionByText(page, /Employment/i);
      await employmentEntry.click();
      await expect(employmentEntry).toHaveAttribute('data-active', 'true');

      await page.locator('[data-testid="step-nav-next"]').click();

      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
    });

    test('Back from Record Search lands on Employment when Personal Info is skipped (spec edge case 5)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec edge case 5: "Back from Record Search lands on Employment."

      await loginToPortal(page, ONLY_RECORD_SEARCH_TOKEN);

      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await recordSearchEntry.click();
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');

      await page.locator('[data-testid="step-nav-back"]').click();

      const employmentEntry = sectionByText(page, /Employment/i);
      await expect(employmentEntry).toHaveAttribute('data-active', 'true');
    });

    test('Next from Personal Info skips Record Search and lands on the after-services workflow when Record Search is skipped (spec edge case 5)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 6 + edge case 5 — when only Personal Info has
      // content, Next from Personal Info must skip Record Search.

      await loginToPortal(page, ONLY_PERSONAL_INFO_TOKEN);

      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      await page.locator('[data-testid="step-nav-next"]').click();

      // The new active entry must NOT be Record Search.
      const recordSearchEntry = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: /Record Search Requirements/i });
      await expect(recordSearchEntry).toHaveCount(0);

      const activeSection = page.locator('[data-testid="section-item"][data-active="true"]');
      await expect(activeSection).not.toContainText(/Record Search Requirements/i);
    });

    test('Both dynamic steps skipped — Next from the last service section skips both and lands on the next visible step (spec edge case 4)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec edge case 4: "Navigation goes from Step 6 directly to Step 9."
      // (or to the after-services workflow if one exists between Step 6 and
      // Step 9). The exact destination depends on the fixture's
      // after-services workflow, but it must NOT be Personal Info or Record
      // Search, since both are hidden in this fixture.

      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      // Click the last visible section before Review & Submit. Reasoning:
      // sidebar order is [..., last_service_or_workflow, ..., review_submit].
      // With both dynamic steps hidden, the section before the review entry
      // is either an after-services workflow or the last service section.
      const allSidebarEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allSidebarEntries.count();
      expect(total).toBeGreaterThanOrEqual(2);

      const secondToLast = allSidebarEntries.nth(total - 2);
      await secondToLast.click();
      await page.locator('[data-testid="step-nav-next"]').click();

      // The new active section must NOT be Personal Info or Record Search
      // (they are not in the navigation set at all in this fixture).
      const active = page.locator(
        '[data-testid="section-item"][data-active="true"], [data-testid="review-submit-item"][data-active="true"]',
      );
      await expect(active).not.toContainText(/Personal Info/i);
      await expect(active).not.toContainText(/Record Search Requirements/i);
    });
  });

  // -------------------------------------------------------------------------
  // Silent recalculation on arrival (spec Business Rules 1, 2, 8; DoD 1, 2,
  // 8). Recalculation runs when the candidate navigates to Step 7 or Step 8;
  // no warning banner / toast / alert appears as a result.
  // -------------------------------------------------------------------------

  test.describe('Recalculation on arrival is silent', () => {
    test('Arriving at Personal Info renders the step without showing a warning banner or alert', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 1 + Business Rule 8: "No warnings or alerts."
      // The candidate navigates to Personal Info. The page must render
      // normally. No element with role alert / no "Your information has
      // changed" / no "Some fields have been removed" text appears.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      // No banner / no alert appears as a result of the recalculation.
      await expect(page.locator('[role="alert"]')).toHaveCount(0);
      await expect(page.getByText(/your information has changed/i)).toHaveCount(0);
      await expect(page.getByText(/some fields have been removed/i)).toHaveCount(0);
      await expect(page.getByText(/your fields have been recalculated/i)).toHaveCount(0);
    });

    test('Arriving at Record Search Requirements renders the step without showing a warning banner or alert', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 2 + Business Rule 8.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await recordSearchEntry.click();
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');

      await expect(page.locator('[role="alert"]')).toHaveCount(0);
      await expect(page.getByText(/your information has changed/i)).toHaveCount(0);
      await expect(page.getByText(/some fields have been removed/i)).toHaveCount(0);
    });

    test('Recalculation does not show a loading spinner on Step 7 or Step 8 (Business Rule 11)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 11 + Definition of Done 12: "Recalculation
      // completes in under 1 second. The candidate should not see any
      // loading spinner or delay when navigating to these steps."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // Step 7
      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');
      await expect(page.locator('[data-testid="recalculation-spinner"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="step-loading"]')).toHaveCount(0);

      // Step 8
      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await recordSearchEntry.click();
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
      await expect(page.locator('[data-testid="recalculation-spinner"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="step-loading"]')).toHaveCount(0);
    });

    test('Arriving at Personal Info does NOT fire a /save POST as a result of recalculation alone (Business Rule 10)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 10 + Definition of Done 14: "Recalculation does
      // not trigger auto-save. The act of recalculating which fields are
      // visible does not itself trigger a save."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // First, navigate to a different section to clear any startup save.
      const employmentEntry = sectionByText(page, /Employment/i);
      await employmentEntry.click();
      await expect(employmentEntry).toHaveAttribute('data-active', 'true');

      // Track every POST to /save sent from this point on. We do NOT type
      // anything into any input — we only navigate to Personal Info.
      const saves: string[] = [];
      const trackSaves = (request: import('@playwright/test').Request) => {
        if (request.method() !== 'POST') return;
        const url = request.url();
        if (
          !url.includes('/api/candidate/application/') ||
          !url.endsWith('/save')
        ) {
          return;
        }
        saves.push(request.postData() || '');
      };
      page.on('request', trackSaves);

      // Navigate to Personal Info. This is the recalculation trigger.
      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      // Give the app a brief moment to settle. Auto-save is debounced on
      // blur; pure navigation should never enqueue one.
      await page.waitForTimeout(500);
      page.off('request', trackSaves);

      // None of the captured saves carries a Personal Info section save
      // triggered by the navigation itself. If the implementer's
      // recalculation accidentally writes fieldValues for Personal Info on
      // arrival, this assertion will catch it.
      const personalInfoSaves = saves.filter((body) =>
        body.includes('"sectionType":"personal_info"'),
      );
      expect(personalInfoSaves).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Sidebar position when both steps are visible (spec rule 5, 6 baseline)
  // -------------------------------------------------------------------------

  test.describe('Sidebar ordering — visible dynamic steps preserve their position', () => {
    test('Personal Info sits before Record Search when both are visible', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // The relative order of the dynamic steps in the sidebar is fixed
      // by the structure endpoint. Filtering must not reorder anything.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const personalInfoIndex = await sidebarIndex(page, /Personal Info/i);
      const recordSearchIndex = await sidebarIndex(page, /Record Search Requirements/i);

      expect(personalInfoIndex).toBeGreaterThanOrEqual(0);
      expect(recordSearchIndex).toBeGreaterThan(personalInfoIndex);
    });

    test('Review & Submit remains the last entry in the sidebar regardless of which dynamic steps are visible', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Review & Submit must always be the final entry — even when one or
      // both dynamic steps are hidden.

      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      const allEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allEntries.count();
      expect(total).toBeGreaterThanOrEqual(1);

      const last = allEntries.nth(total - 1);
      await expect(last).toContainText(/Review/i);
    });
  });

  // -------------------------------------------------------------------------
  // Review & Submit accounts for the dynamic step set (spec Business Rule 9
  // a/b/c/d; DoD 9, 10, 11)
  // -------------------------------------------------------------------------

  test.describe('Review & Submit summary respects step visibility', () => {
    test('Review & Submit does NOT list Personal Info or Record Search when both are skipped (Business Rule 9 a + b)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 9 a: "If Step 7 is skipped, it does not appear
      // in the review summary."
      // Spec Business Rule 9 b: "If Step 8 is skipped, same treatment."
      // Spec Definition of Done 9.

      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      // Navigate to Review & Submit (the last entry).
      const allEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allEntries.count();
      await allEntries.nth(total - 1).click();

      // Review summary must not show Personal Info or Record Search.
      // The plan §5.3 / §5.4 says the shell passes a filtered section
      // descriptor list to <ReviewSubmitPage>. We assert on the rendered
      // review page area (the heading is set by the Review & Submit step).
      const reviewPage = page.locator('[data-testid="review-submit-page"]');
      await expect(reviewPage).toBeVisible();

      // Neither section name appears in the review summary list.
      await expect(reviewPage.getByText(/Personal Info/i)).toHaveCount(0);
      await expect(reviewPage.getByText(/Record Search Requirements/i)).toHaveCount(0);
    });

    test('Submit button is enabled when skipped dynamic steps are not blocking submission (Business Rule 9 c)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 9 c: "If a step was previously visible and
      // complete but is now skipped (because recalculation removed all
      // its content), it does not block submission."
      // Spec Definition of Done 10: "Review & Submit does not require
      // skipped steps to be complete for submission."
      //
      // This fixture (NO_DYNAMIC_CONTENT_TOKEN) has both dynamic steps
      // skipped, and the other steps are complete enough to submit. The
      // shell's effectiveValidationResult / disableSubmitForDynamicGaps
      // path must NOT block submission just because the engine still has
      // an "incomplete" verdict for a now-skipped section.

      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      const allEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allEntries.count();
      await allEntries.nth(total - 1).click();

      const submitButton = page.getByRole('button', { name: /Submit/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
    });

    test('Submit button is DISABLED when a newly-visible dynamic step is incomplete (Business Rule 9 d)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 9 d: "If a step was previously skipped but is
      // now visible (because recalculation added new content), it appears
      // as incomplete in the review and the candidate must go back and
      // fill it in before submitting."
      // Spec Definition of Done 11: "Review & Submit does require
      // newly-visible steps (that were previously skipped) to be complete
      // for submission."
      //
      // This fixture has Personal Info visible with at least one required
      // field still empty. Submit must be disabled.

      await loginToPortal(page, ONLY_PERSONAL_INFO_TOKEN);

      const allEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allEntries.count();
      await allEntries.nth(total - 1).click();

      // Submit button is disabled because Personal Info is visible but
      // contains required fields that have not yet been filled in.
      const submitButton = page.getByRole('button', { name: /Submit/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeDisabled();
    });

    test('Personal Info appears in the Review & Submit summary when it is visible (Business Rule 9 d)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // The flip side of 9 a — when Personal Info IS visible, it must
      // appear in the review summary so the candidate can navigate back
      // to fill it in.

      await loginToPortal(page, ONLY_PERSONAL_INFO_TOKEN);

      const allEntries = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await allEntries.count();
      await allEntries.nth(total - 1).click();

      const reviewPage = page.locator('[data-testid="review-submit-page"]');
      await expect(reviewPage).toBeVisible();
      await expect(reviewPage.getByText(/Personal Info/i)).toHaveCount(1);
      await expect(reviewPage.getByText(/Record Search Requirements/i)).toHaveCount(0);
    });
  });

  // -------------------------------------------------------------------------
  // Performance / DoD 12 — recalculation completes quickly (spec rule 11)
  // -------------------------------------------------------------------------

  test.describe('Performance', () => {
    test('Navigating to Personal Info completes the recalculation within 1 second (Business Rule 11)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 11 + Definition of Done 12: "Recalculation
      // (determining which fields to show or hide on Steps 7 and 8) must
      // complete in under 1 second."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // Click Employment first so the next click does meaningful work.
      const employmentEntry = sectionByText(page, /Employment/i);
      await employmentEntry.click();
      await expect(employmentEntry).toHaveAttribute('data-active', 'true');

      const start = Date.now();
      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });

    test('Navigating to Record Search Requirements completes the recalculation within 1 second (Business Rule 11)', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      const start = Date.now();
      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await recordSearchEntry.click();
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });

  // -------------------------------------------------------------------------
  // Rapid navigation produces correct results (spec rule 12; DoD 13)
  // -------------------------------------------------------------------------

  test.describe('Rapid navigation', () => {
    test('Clicking Next then Back ten times rapidly leaves the candidate on a valid, visible step', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 12 + Definition of Done 13: "Rapid navigation
      // between steps produces correct results every time."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      // Start from the first section.
      const firstSection = sections(page).first();
      await firstSection.click();
      await expect(firstSection).toHaveAttribute('data-active', 'true');

      // Hammer Next/Back ten times each. No assertions on intermediate
      // state — the requirement is that the final state is consistent
      // (one active section, no console errors visible to the user).
      for (let i = 0; i < 10; i += 1) {
        const nextButton = page.locator('[data-testid="step-nav-next"]');
        if ((await nextButton.count()) > 0 && (await nextButton.isVisible())) {
          await nextButton.click();
        }
      }
      for (let i = 0; i < 10; i += 1) {
        const backButton = page.locator('[data-testid="step-nav-back"]');
        if ((await backButton.count()) > 0 && (await backButton.isVisible())) {
          await backButton.click();
        }
      }

      // Exactly one sidebar entry is active.
      const active = page.locator(
        '[data-testid="section-item"][data-active="true"], [data-testid="review-submit-item"][data-active="true"]',
      );
      await expect(active).toHaveCount(1);

      // The active entry is in the currently-visible set (i.e. has a
      // sidebar entry — recalculation never strands the candidate).
      const activeText = ((await active.first().textContent()) || '').trim();
      expect(activeText.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Mobile / 320px (DoD 15)
  // -------------------------------------------------------------------------

  test.describe('Mobile layout (320px minimum)', () => {
    test('Sidebar drawer renders only visible dynamic steps on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Definition of Done 15: "Mobile layout (320px minimum) works
      // correctly with step skipping — sidebar drawer, progress
      // indicators, and Next/Back buttons all handle dynamic steps."

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, NO_DYNAMIC_CONTENT_TOKEN);

      // Open the mobile drawer if there is a toggle button (the existing
      // shell uses [data-testid="mobile-menu-toggle"] per
      // candidate-portal-shell.spec.ts). If absent in this fixture, the
      // sidebar entries are still queryable directly.
      const menuToggle = page.locator('[data-testid="mobile-menu-toggle"]');
      if ((await menuToggle.count()) > 0) {
        await menuToggle.click();
      }

      // No Personal Info or Record Search entries appear in the mobile
      // sidebar when both are skipped.
      await expect(
        page.locator('[data-testid="section-item"]').filter({ hasText: /Personal Info/i }),
      ).toHaveCount(0);
      await expect(
        page
          .locator('[data-testid="section-item"]')
          .filter({ hasText: /Record Search Requirements/i }),
      ).toHaveCount(0);
    });

    test('Next/Back buttons still skip hidden dynamic steps on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Definition of Done 15.

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, ONLY_RECORD_SEARCH_TOKEN);

      const employmentEntry = sectionByText(page, /Employment/i);
      await employmentEntry.click();
      await expect(employmentEntry).toHaveAttribute('data-active', 'true');

      await page.locator('[data-testid="step-nav-next"]').click();

      // The new active section must be Record Search (Personal Info is
      // skipped in this fixture).
      const recordSearchEntry = sectionByText(page, /Record Search Requirements/i);
      await expect(recordSearchEntry).toHaveAttribute('data-active', 'true');
    });
  });

  // -------------------------------------------------------------------------
  // Auto-save continues to work (spec rule 14, DoD 14)
  // -------------------------------------------------------------------------

  test.describe('Auto-save behavior is unchanged by recalculation', () => {
    test('Typing into a Personal Info field after recalculation still fires the normal /save POST on blur', async ({ page }) => {
      // THIS TEST WILL FAIL — feature does not exist yet.
      // Spec Business Rule 10: "Recalculation does not trigger auto-save.
      // Auto-save continues to work as normal — on field blur."
      // Spec Definition of Done 14: "All existing auto-save behavior
      // continues to work correctly."

      await loginToPortal(page, FULL_DYNAMIC_TOKEN);

      const personalInfoEntry = sectionByText(page, /Personal Info/i);
      await personalInfoEntry.click();
      await expect(personalInfoEntry).toHaveAttribute('data-active', 'true');

      const savePromise = page.waitForRequest((request) => {
        if (request.method() !== 'POST') return false;
        if (
          !request.url().includes('/api/candidate/application/') ||
          !request.url().endsWith('/save')
        ) {
          return false;
        }
        const body = request.postData() || '';
        return body.includes('"sectionType":"personal_info"');
      });

      // Type into the first visible Personal Info input, then blur to
      // trigger auto-save. The exact field depends on the candidate's
      // country selections, so we pick the first dynamic field on the
      // page.
      const firstInput = page.locator('input[type="text"], input:not([type])').first();
      await firstInput.fill('Test value for personal info recalc');
      await firstInput.blur();

      const saveRequest = await savePromise;
      const body = saveRequest.postData() || '';
      expect(body).toContain('"sectionType":"personal_info"');
      expect(body).toContain('"fieldValues"');
    });
  });
});
