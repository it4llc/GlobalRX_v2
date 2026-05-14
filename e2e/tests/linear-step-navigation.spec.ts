// /GlobalRX_v2/e2e/tests/linear-step-navigation.spec.ts
// Pass 1 End-to-end tests for the Linear Step Navigation feature.
// Spec: docs/specs/linear-step-navigation.md
// Plan: docs/plans/linear-step-navigation-technical-plan.md
//
// These tests describe candidate-facing behaviour for the new 9-step
// linear navigation flow and the Next / Back buttons added at the bottom
// of every step. They are intentionally written BEFORE the implementer
// produces the feature, so every assertion below is expected to FAIL on
// first run (RED phase of TDD). The implementer makes them pass.
//
// Token / password placeholders match the conventions already used in
// candidate-portal-shell.spec.ts and candidate-login-session.spec.ts.

import { test, expect } from '@playwright/test';

const PORTAL_PASSWORD = 'TestPassword123!';

/**
 * Token covering the full 9-step package:
 *  - 1+ before_services workflow section(s)
 *  - IDV service
 *  - Address History (record service)
 *  - Education service
 *  - Employment service
 *  - Personal Info (always present)
 *  - 1+ after_services workflow section(s)
 *  - Review & Submit (synthetic)
 */
const FULL_PACKAGE_TOKEN = 'test-valid-token-123';

/**
 * Token whose package omits IDV. Used to assert that Next from a
 * before_services workflow jumps over IDV straight to Address History
 * (spec rule 6 + edge case 1).
 */
const NO_IDV_TOKEN = 'test-no-idv-token';

/**
 * Token whose package has no before_services workflow sections. Used to
 * assert that the first step (which is now IDV or address_history rather
 * than personal_info) has no Back button (spec rule 4 + edge case 2).
 */
const NO_BEFORE_SERVICES_TOKEN = 'test-no-before-services-token';

/**
 * Token whose package contains only one navigable step (extremely
 * unlikely but covered by spec edge case 4). Used to assert no Next or
 * Back button is rendered.
 */
const SINGLE_STEP_TOKEN = 'test-single-step-token';

/**
 * Helper that logs the candidate in via the password form and waits for
 * the portal URL. Mirrors the login flow used in candidate-portal-shell.spec.ts.
 */
async function loginToPortal(page: import('@playwright/test').Page, token: string) {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

test.describe('Linear Step Navigation - E2E Tests', () => {

  test.describe('Step ordering returned by the structure endpoint', () => {
    test('candidate sees sections in the new 9-step order', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 1, Definition of Done item 1.
      //
      // The structure endpoint must return sections in the new order:
      //   before_services -> IDV -> address_history -> education ->
      //   employment -> personal_info -> after_services -> review_submit
      // The sidebar renders sections in that order without re-sorting, so
      // the order of [data-testid="section-item"] in the DOM is the order
      // returned by the endpoint.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // The first visible section in the sidebar is a before_services
      // workflow section (e.g. Welcome). It MUST NOT be Personal Info
      // (Personal Info was step 2 in the old flow; it is step 6 in the
      // new flow).
      const sections = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      await expect(sections.first()).toBeVisible();
      await expect(sections.first()).not.toContainText('Personal Info', { ignoreCase: true });
      await expect(sections.first()).not.toContainText('Personal Information', { ignoreCase: true });

      // Identity Verification must appear BEFORE Personal Information.
      const idvIndex = await sections
        .filter({ hasText: /Identity Verification/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });
      const personalInfoIndex = await sections
        .filter({ hasText: /Personal Info/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });
      expect(idvIndex).toBeGreaterThanOrEqual(0);
      expect(personalInfoIndex).toBeGreaterThan(idvIndex);

      // Address History must appear before Personal Information.
      const addressIndex = await sections
        .filter({ hasText: /Address History/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });
      expect(addressIndex).toBeGreaterThan(idvIndex);
      expect(personalInfoIndex).toBeGreaterThan(addressIndex);

      // Education and Employment must appear before Personal Information.
      const educationIndex = await sections
        .filter({ hasText: /Education/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });
      const employmentIndex = await sections
        .filter({ hasText: /Employment/i })
        .first()
        .evaluate((el) => {
          const all = Array.from(document.querySelectorAll('[data-testid="section-item"]'));
          return all.indexOf(el as Element);
        });
      expect(educationIndex).toBeGreaterThan(addressIndex);
      expect(employmentIndex).toBeGreaterThan(educationIndex);
      expect(personalInfoIndex).toBeGreaterThan(employmentIndex);

      // Review & Submit is always the final entry.
      const lastSection = sections.last();
      await expect(lastSection).toContainText(/Review/i);
    });
  });

  test.describe('Next and Back buttons render on every step', () => {
    test('every non-review step shows the shared step-navigation container', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 2 + Definition of Done item 2.
      // Every non-review step's content area must include the shared
      // [data-testid="step-navigation"] container.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      const total = await sections.count();
      expect(total).toBeGreaterThan(1);

      // Click each section that is NOT the final Review & Submit step
      // and confirm the step-navigation container is rendered.
      for (let i = 0; i < total - 1; i += 1) {
        await sections.nth(i).click();
        await expect(page.locator('[data-testid="step-navigation"]')).toBeVisible();
      }
    });

    test('Next button uses primary/filled style and Back button uses secondary/outline style', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 3 + Definition of Done item 3.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Move off the first section so both buttons render.
      const sections = page.locator('[data-testid="section-item"]');
      await sections.nth(1).click();

      const nextButton = page.locator('[data-testid="step-nav-next"]');
      const backButton = page.locator('[data-testid="step-nav-back"]');

      await expect(nextButton).toBeVisible();
      await expect(backButton).toBeVisible();

      // Next is the primary action — filled blue background, white text.
      const nextClass = (await nextButton.getAttribute('class')) || '';
      expect(nextClass).toMatch(/bg-blue-/);
      expect(nextClass).toMatch(/text-white/);

      // Back is the secondary action — outline / white background with a
      // border. It must NOT use the primary blue fill.
      const backClass = (await backButton.getAttribute('class')) || '';
      expect(backClass).toMatch(/border/);
      expect(backClass).toMatch(/bg-white/);
      expect(backClass).not.toMatch(/bg-blue-/);
    });
  });

  test.describe('First step suppresses Back; Review & Submit suppresses Next', () => {
    test('first step shows Next but NOT Back', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 4 + Definition of Done item 4.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // The portal opens with the first applicable section active.
      // First step must show Next but NOT Back.
      await expect(page.locator('[data-testid="step-nav-next"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-nav-back"]')).toHaveCount(0);
    });

    test('first step still suppresses Back when there are no before-service workflow sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec edge case 2 — when no before_services workflow exists, the
      // first step becomes IDV (or address_history, etc.). It still has
      // no Back button.

      await loginToPortal(page, NO_BEFORE_SERVICES_TOKEN);

      await expect(page.locator('[data-testid="step-nav-next"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-nav-back"]')).toHaveCount(0);
    });

    test('Review & Submit step shows the page-level Back button but NOT the shared Next button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 4 (no Next on review) + Business Rule 5
      // (Back appears alongside Submit in the same row) + Definition of
      // Done item 5.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      await sections.last().click();

      // The Review & Submit page renders its OWN Back button alongside
      // the Submit button via [data-testid="review-back-button"]. The
      // shared [data-testid="step-navigation"] container must NOT appear
      // on this step (otherwise two Back buttons would be visible).
      await expect(page.locator('[data-testid="step-navigation"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="step-nav-next"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="review-back-button"]')).toBeVisible();

      // The existing Submit button stays on the page. Per the spec it
      // sits in the same row as the Back button.
      const submitButton = page.getByRole('button', { name: /Submit/i });
      await expect(submitButton).toBeVisible();
    });
  });

  test.describe('Navigation behaviour', () => {
    test('clicking Next advances to the next applicable step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Definition of Done item 2 + Business Rule 7 (reuse existing
      // handleSectionClick) and the basic navigation contract.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      const firstActiveText = await sections.first().textContent();

      // Click Next and confirm the active section changes to whatever
      // sits at index 1 in the sidebar.
      await page.locator('[data-testid="step-nav-next"]').click();

      const secondSection = sections.nth(1);
      await expect(secondSection).toHaveAttribute('data-active', 'true');
      await expect(sections.first()).not.toHaveAttribute('data-active', 'true');

      // Sanity-check that the active section text changed.
      const newActiveText = await secondSection.textContent();
      expect(newActiveText).not.toEqual(firstActiveText);
    });

    test('clicking Back returns to the previous applicable step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 7.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');

      // Advance to step 2 via Next.
      await page.locator('[data-testid="step-nav-next"]').click();
      await expect(sections.nth(1)).toHaveAttribute('data-active', 'true');

      // Click Back and confirm we are back on step 1.
      await page.locator('[data-testid="step-nav-back"]').click();
      await expect(sections.first()).toHaveAttribute('data-active', 'true');
      await expect(sections.nth(1)).not.toHaveAttribute('data-active', 'true');
    });

    test('Next skips steps that are not in the candidate\'s package', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 6 + Definition of Done item 6 + edge case 1.
      //
      // For a package with NO IDV, pressing Next from the first
      // before-service step must land on Address History, NOT IDV
      // (because IDV isn't in the sidebar at all).

      await loginToPortal(page, NO_IDV_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');

      // IDV must not appear in the sidebar at all for this token.
      await expect(sections.filter({ hasText: /Identity Verification/i })).toHaveCount(0);

      // Click Next from the first step. The new active section must be
      // Address History.
      await page.locator('[data-testid="step-nav-next"]').click();
      const activeSection = page.locator('[data-testid="section-item"][data-active="true"]');
      await expect(activeSection).toContainText(/Address History/i);
    });

    test('using the sidebar mid-flow makes Next/Back navigate relative to the new position', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Definition of Done item 9 + edge case 5.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      const total = await sections.count();
      expect(total).toBeGreaterThanOrEqual(4);

      // Jump to the 3rd section directly via the sidebar.
      const targetIndex = 2;
      const sidebarTarget = sections.nth(targetIndex);
      const sidebarTargetText = await sidebarTarget.textContent();
      await sidebarTarget.click();
      await expect(sidebarTarget).toHaveAttribute('data-active', 'true');

      // Press Next — the new active section must be the 4th sidebar entry.
      await page.locator('[data-testid="step-nav-next"]').click();
      const afterNext = sections.nth(targetIndex + 1);
      await expect(afterNext).toHaveAttribute('data-active', 'true');
      const afterNextText = await afterNext.textContent();
      expect(afterNextText).not.toEqual(sidebarTargetText);

      // Press Back — we should be back on the original 3rd entry.
      await page.locator('[data-testid="step-nav-back"]').click();
      await expect(sections.nth(targetIndex)).toHaveAttribute('data-active', 'true');
    });

    test('Review & Submit page Back button navigates to the previous applicable step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 5 (Back next to Submit on the review step
      // must function as the Back navigation).

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      const total = await sections.count();
      const lastSection = sections.nth(total - 1);
      const secondToLastSection = sections.nth(total - 2);
      const secondToLastText = await secondToLastSection.textContent();

      // Jump to Review & Submit.
      await lastSection.click();
      await expect(lastSection).toHaveAttribute('data-active', 'true');

      // Click the in-page Back button.
      await page.locator('[data-testid="review-back-button"]').click();

      // The previous applicable step is now active.
      await expect(secondToLastSection).toHaveAttribute('data-active', 'true');
      const activeText = await page
        .locator('[data-testid="section-item"][data-active="true"]')
        .textContent();
      expect(activeText).toEqual(secondToLastText);
    });
  });

  test.describe('Scroll-to-top behaviour', () => {
    test('clicking Next scrolls the page to the top of the new section', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 11 + Definition of Done item 7.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Scroll the candidate portal main content down so we have somewhere
      // to scroll back from. The plan uses window.scrollTo, but the main
      // content area may also have its own scroll container — assert on
      // whichever the implementer wired up by checking both.
      await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]') as HTMLElement | null;
        if (main) {
          main.scrollTop = 9999;
        }
        window.scrollTo({ top: 9999 });
      });

      const scrollBefore = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]') as HTMLElement | null;
        return {
          window: window.scrollY,
          main: main ? main.scrollTop : 0,
        };
      });
      // At least one of the two must have moved down.
      expect(scrollBefore.window + scrollBefore.main).toBeGreaterThan(0);

      // Press Next.
      await page.locator('[data-testid="step-nav-next"]').click();

      // After the navigation completes, both scroll positions must be at
      // the top of the new section. The spec phrasing ("scrolls the page
      // to the top of the new section") is satisfied as long as the
      // candidate isn't stranded at the bottom — both values should be 0.
      await expect.poll(async () => {
        return page.evaluate(() => {
          const main = document.querySelector('[data-testid="main-content"]') as HTMLElement | null;
          return {
            window: window.scrollY,
            main: main ? main.scrollTop : 0,
          };
        });
      }, { timeout: 2000 }).toEqual({ window: 0, main: 0 });
    });

    test('clicking Back scrolls the page to the top of the new section', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 11 — applies to Back as well as Next.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Advance one step so we have a Back button.
      await page.locator('[data-testid="step-nav-next"]').click();
      await expect(page.locator('[data-testid="step-nav-back"]')).toBeVisible();

      // Scroll down inside the new section.
      await page.evaluate(() => {
        const main = document.querySelector('[data-testid="main-content"]') as HTMLElement | null;
        if (main) {
          main.scrollTop = 9999;
        }
        window.scrollTo({ top: 9999 });
      });

      // Press Back.
      await page.locator('[data-testid="step-nav-back"]').click();

      await expect.poll(async () => {
        return page.evaluate(() => {
          const main = document.querySelector('[data-testid="main-content"]') as HTMLElement | null;
          return {
            window: window.scrollY,
            main: main ? main.scrollTop : 0,
          };
        });
      }, { timeout: 2000 }).toEqual({ window: 0, main: 0 });
    });
  });

  test.describe('Mobile tap targets and small-screen behaviour', () => {
    test('Next and Back buttons are at least 44px tall on mobile', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 12 + Definition of Done item 10.

      await page.setViewportSize({ width: 375, height: 812 });
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      await sections.nth(1).click();

      const nextButton = page.locator('[data-testid="step-nav-next"]');
      const backButton = page.locator('[data-testid="step-nav-back"]');

      const nextBox = await nextButton.boundingBox();
      const backBox = await backButton.boundingBox();
      expect(nextBox).not.toBeNull();
      expect(backBox).not.toBeNull();
      expect(nextBox!.height).toBeGreaterThanOrEqual(44);
      expect(backBox!.height).toBeGreaterThanOrEqual(44);
    });

    test('Next and Back buttons remain usable on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 12 / edge case 7 / Definition of Done item 11.
      //
      // At 320px the buttons should be full-width (or nearly so) and
      // clearly visible without horizontal scrolling.

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      await sections.nth(1).click();

      const nextButton = page.locator('[data-testid="step-nav-next"]');
      const backButton = page.locator('[data-testid="step-nav-back"]');
      await expect(nextButton).toBeVisible();
      await expect(backButton).toBeVisible();

      const nextBox = await nextButton.boundingBox();
      const backBox = await backButton.boundingBox();
      expect(nextBox).not.toBeNull();
      expect(backBox).not.toBeNull();

      // Tap target rule still applies.
      expect(nextBox!.height).toBeGreaterThanOrEqual(44);
      expect(backBox!.height).toBeGreaterThanOrEqual(44);

      // Buttons must not overflow the viewport horizontally.
      expect(nextBox!.x + nextBox!.width).toBeLessThanOrEqual(320);
      expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(320);
    });

    test('Review & Submit step still works on a 320px-wide screen', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 5 + edge case 7 — Back beside Submit must
      // remain usable on the narrowest supported screen.

      await page.setViewportSize({ width: 320, height: 568 });
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator(
        '[data-testid="section-item"], [data-testid="review-submit-item"]',
      );
      await sections.last().click();

      const reviewBack = page.locator('[data-testid="review-back-button"]');
      const submitButton = page.getByRole('button', { name: /Submit/i });

      await expect(reviewBack).toBeVisible();
      await expect(submitButton).toBeVisible();

      const backBox = await reviewBack.boundingBox();
      expect(backBox).not.toBeNull();
      expect(backBox!.height).toBeGreaterThanOrEqual(44);
      expect(backBox!.x + backBox!.width).toBeLessThanOrEqual(320);
    });
  });

  test.describe('Single-step edge case', () => {
    test('no Next or Back button is rendered when only one step exists', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec edge case 4 — when only one navigable step exists, neither
      // Next nor Back should appear.

      await loginToPortal(page, SINGLE_STEP_TOKEN);

      await expect(page.locator('[data-testid="step-nav-next"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="step-nav-back"]')).toHaveCount(0);
    });
  });

  test.describe('Sidebar and progress indicators continue to work', () => {
    test('clicking a section in the sidebar still navigates to it', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 8 + Definition of Done item 8.
      // The new Next/Back buttons must not break existing sidebar navigation.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      const total = await sections.count();
      expect(total).toBeGreaterThanOrEqual(3);

      const target = sections.nth(2);
      const targetText = await target.textContent();
      await target.click();
      await expect(target).toHaveAttribute('data-active', 'true');

      // The active section's content should now be rendered in main content.
      const mainContent = page.locator('[data-testid="main-content"]');
      await expect(mainContent).toBeVisible();
      if (targetText && targetText.trim().length > 0) {
        // Best-effort assertion that the section name appears somewhere on
        // the page after the click. Headings in section components may
        // differ from sidebar labels, so we don't strictly require a
        // match — but if the implementer happens to render the label,
        // this catches obvious regressions.
        // We only require that nothing else stole `data-active`.
        const activeCount = await page
          .locator('[data-testid="section-item"][data-active="true"]')
          .count();
        expect(activeCount).toBe(1);
      }
    });

    test('section status indicators still render in the sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 10 + Definition of Done item 13.
      // The existing progress indicators (green check / red exclamation /
      // grey circle) must continue to display next to each sidebar entry.

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const statusIndicators = page.locator('[data-testid="section-status"]');
      const count = await statusIndicators.count();
      expect(count).toBeGreaterThan(0);

      // Every sidebar entry has a status indicator next to it.
      const sectionCount = await page.locator('[data-testid="section-item"]').count();
      expect(count).toBe(sectionCount);
    });

    test('sidebar entries do not display step numbers in the visible label', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec Business Rule 9 — sidebar shows section names only, no
      // step numbers like "1." or "Step 1:".

      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const sections = page.locator('[data-testid="section-item"]');
      const total = await sections.count();
      for (let i = 0; i < total; i += 1) {
        const text = ((await sections.nth(i).textContent()) || '').trim();
        // Reject leading "1." / "1)" / "Step 1" / "Step 1:" patterns.
        expect(text).not.toMatch(/^\s*Step\s+\d+/i);
        expect(text).not.toMatch(/^\s*\d+[.)]\s/);
      }
    });
  });
});
