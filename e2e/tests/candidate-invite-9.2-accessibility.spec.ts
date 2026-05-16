// /GlobalRX_v2/e2e/tests/candidate-invite-9.2-accessibility.spec.ts
// Pass 1 end-to-end tests for Task 9.2 — Accessibility Audit & Improvements.
// Spec / technical plan: docs/specs/candidate-invite-9.2-accessibility-audit.md
//
// These tests describe the candidate-facing accessibility contract for the
// 9-step candidate application after Task 9.2 lands. They are intentionally
// written BEFORE the implementer produces the feature, so every assertion
// below is expected to FAIL on first run (RED phase of TDD). The implementer
// makes them pass.
//
// What this Pass 1 e2e file covers (and does NOT cover):
//   COVERS:
//     - Skip link presence, keyboard reveal, and #main-content target
//     - ARIA landmarks (role=main, role=navigation) on portal-layout shell
//     - Sidebar step item ARIA (role=list / role=listitem / aria-current /
//       aria-label including step number + name + status)
//     - Mobile drawer ARIA (aria-modal, role=dialog, aria-label) and
//       hamburger aria-expanded / aria-controls
//     - Mobile drawer Escape key + overlay click closes drawer
//     - Mobile drawer focus trap (Tab cycles inside the drawer)
//     - Focus moves to the new step's heading after Next / Back / sidebar
//     - Live announcer (#candidate-live-region with aria-live="polite")
//       receives "Progress saved", "Cannot continue — X fields need
//       attention", "New required fields have been added", and
//       "Requirements have been updated based on your entries"
//     - Next button validation failure focuses the first errored field
//     - Next / Back buttons expose destination in aria-label
//     - Next / Back buttons meet 44px minimum touch-target on mobile
//     - SectionProgressIndicator exposes sr-only status text and
//       aria-hidden decorative icons
//     - WorkflowSectionRenderer wraps content in role="document" with
//       aria-label and tabIndex=0
//     - PersonalInfo form-field accessibility: matching label/id pairs,
//       aria-required on required fields, aria-invalid + aria-describedby
//       on errored fields
//     - Address / Education / Employment fieldset + legend per entry,
//       contextual aria-labels on date fields, descriptive aria-labels on
//       Add / Remove buttons, focus moves to first field of new entry on
//       Add, focus moves to previous entry on Remove
//     - Employment gap entry legend formatting
//     - Review & Submit role="alert" summary, h3 per section, descriptive
//       jump-link aria-labels, Submit button aria-disabled when incomplete
//       + aria-describedby to explanation
//     - Visible :focus-visible outline on interactive elements
//     - prefers-reduced-motion disables animation/transition durations
//   DOES NOT COVER (deferred to Pass 2 — needs real source files / mocks):
//     - jest-axe component tests for SkipLink, StepHeading, LiveAnnouncer,
//       portal-layout, portal-sidebar, SectionProgressIndicator,
//       WorkflowSectionRenderer, PersonalInfoSection, address/education/
//       employment/record-search/review section components
//     - Unit tests for useFocusManagement and useKeyboardNavigation hooks
//     - Unit tests for src/lib/candidate/a11y-constants.ts
//     - Translation-key presence per locale (covered by Pass 2 component
//       tests using a real i18n mock)
//
// Token / password placeholders follow the conventions already used in
// candidate-portal-shell.spec.ts, linear-step-navigation.spec.ts, and
// personal-info-dynamic.spec.ts. The implementer is responsible for seeding
// each token against a candidate invitation that matches the inline
// description below the constant.

import { test, expect, type Page } from '@playwright/test';

const PORTAL_PASSWORD = 'TestPassword123!';

/**
 * Token covering the full 9-step package:
 *   - 1+ before_services workflow section(s) — e.g. Welcome
 *   - IDV service (Identity Verification)
 *   - Address History (record service)
 *   - Education service
 *   - Employment service
 *   - Personal Info (always present)
 *   - 1+ after_services workflow section(s)
 *   - Review & Submit (synthetic)
 *
 * Used by every test in this file that needs the full navigation flow.
 */
const FULL_PACKAGE_TOKEN = 'test-valid-token-123';

/**
 * Token whose candidate has at least one Personal Info field with a
 * validation error (e.g. required field left blank). Used to assert the
 * "Cannot continue — X fields need attention" announcement, the focus-to-
 * first-error behaviour, and aria-invalid / aria-describedby wiring.
 */
const TOKEN_WITH_PERSONAL_INFO_ERROR = 'test-a11y-personal-info-error';

/**
 * Token whose Address History scope requires at least two entries so the
 * candidate can exercise Add / Remove and trigger focus management. Also
 * carries at least one gap so the gap-tolerance announcement fires.
 */
const TOKEN_ADDRESS_HISTORY_MULTI = 'test-a11y-address-history-multi';

/**
 * Token whose Education scope requires exactly 2 entries so saving with
 * fewer entries triggers the scope validation announcement.
 */
const TOKEN_EDUCATION_SCOPE = 'test-a11y-education-scope';

/**
 * Token whose Employment scope produces at least one Employment gap entry
 * so the gap-fieldset legend formatting can be asserted.
 */
const TOKEN_EMPLOYMENT_GAP = 'test-a11y-employment-gap';

/**
 * Token whose Record Search Requirements section recalculates (silently)
 * when the candidate changes a country selection on Address History.
 */
const TOKEN_RECORD_SEARCH_RECALC = 'test-a11y-record-search-recalc';

/**
 * Token whose Review & Submit page shows at least one section with errors
 * so the role="alert" summary banner and the descriptive jump-link
 * aria-labels can be asserted.
 */
const TOKEN_REVIEW_WITH_ERRORS = 'test-a11y-review-with-errors';

/**
 * Token whose Personal Info section gains additional subject-targeted
 * fields after the candidate goes back and changes a country selection.
 * Used to assert the "New required fields have been added" announcement.
 */
const TOKEN_PERSONAL_INFO_DYNAMIC_ADD = 'test-a11y-personal-info-dynamic-add';

/**
 * Helper that logs the candidate in via the password form and waits for
 * the portal URL. Mirrors loginToPortal in linear-step-navigation.spec.ts.
 */
async function loginToPortal(page: Page, token: string): Promise<void> {
  await page.goto(`/candidate/${token}`);
  await page.fill('input[name="password"]', PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**/candidate/${token}/portal`);
}

/**
 * Helper that opens a section by its visible label in the sidebar.
 */
async function gotoSection(page: Page, label: RegExp): Promise<void> {
  const entry = page
    .locator('[data-testid="section-item"], [data-testid="review-submit-item"]')
    .filter({ hasText: label })
    .first();
  await entry.click();
  await expect(entry).toHaveAttribute('data-active', 'true');
}

/**
 * Helper that returns the textContent of the live-region as the screen
 * reader would receive it (announcer pushes text into an aria-live="polite"
 * container). The container's id is owned by the implementer; the spec is
 * agnostic about the exact id string, so the test queries by the
 * aria-live attribute instead.
 */
async function readLiveAnnouncement(page: Page): Promise<string> {
  const region = page.locator('[aria-live="polite"]').first();
  await expect(region).toBeAttached();
  return (await region.textContent())?.trim() ?? '';
}

test.describe('Task 9.2 — Accessibility Audit & Improvements — E2E Tests', () => {

  // -----------------------------------------------------------------------
  // SkipLink and main-content landmark
  // (spec: New File #1 src/components/candidate/skip-link.tsx;
  //  spec: portal-layout.tsx — add id="main-content")
  // -----------------------------------------------------------------------

  test.describe('Skip link and main-content landmark', () => {
    test('a Skip to main content link is the first focusable element on the portal', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #1 — SkipLink is rendered before the header and is
      // the first thing a keyboard user lands on when they press Tab.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // The link must EXIST in the DOM at all times (even when visually
      // hidden) so that assistive tech can find it.
      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await expect(skipLink).toHaveCount(1);

      // After the first Tab, focus lands on the SkipLink (it is the first
      // focusable element on the page once a session is active).
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
    });

    test('SkipLink is visually hidden until focused, then becomes visible', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #1 — "Visually hidden until it receives keyboard
      // focus, then it slides into view at the top of the page".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const skipLink = page.getByRole('link', { name: /skip to main content/i });

      // Before focus, the link's bounding box (its rendered area in the
      // viewport) is zero / off-screen. The spec implements this with the
      // `sr-only` utility class.
      const boxBeforeFocus = await skipLink.boundingBox();
      // Either no box (off-screen) or a 1x1 box (the classic sr-only clip).
      if (boxBeforeFocus) {
        expect(boxBeforeFocus.width).toBeLessThanOrEqual(2);
        expect(boxBeforeFocus.height).toBeLessThanOrEqual(2);
      }

      // After focus, the link must be visible in the viewport.
      await skipLink.focus();
      await expect(skipLink).toBeVisible();
      const boxAfterFocus = await skipLink.boundingBox();
      expect(boxAfterFocus).not.toBeNull();
      expect(boxAfterFocus!.width).toBeGreaterThan(2);
      expect(boxAfterFocus!.height).toBeGreaterThan(2);
    });

    test('activating the SkipLink moves focus to #main-content and the URL ends in #main-content', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #1 + portal-layout.tsx modification — "Add
      // id='main-content' to the main content container (the skip link
      // jumps here)".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const skipLink = page.getByRole('link', { name: /skip to main content/i });
      await skipLink.focus();
      await page.keyboard.press('Enter');

      // URL fragment moved to the skip target.
      expect(page.url()).toContain('#main-content');

      // The element with id="main-content" exists.
      const mainContent = page.locator('#main-content');
      await expect(mainContent).toHaveCount(1);
    });
  });

  // -----------------------------------------------------------------------
  // ARIA landmarks on portal-layout
  // (spec: portal-layout.tsx — add role="main" + aria-label="Application
  //  form" on main content; role="navigation" + aria-label="Application
  //  steps" on sidebar)
  // -----------------------------------------------------------------------

  test.describe('Portal layout landmarks', () => {
    test('main content area exposes role="main" and aria-label="Application form"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-layout.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Exactly one main landmark; getByRole('main') finds either role=main
      // or a <main> element.
      const main = page.getByRole('main', { name: /application form/i });
      await expect(main).toHaveCount(1);
      await expect(main).toBeVisible();
    });

    test('sidebar exposes role="navigation" and aria-label="Application steps"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const nav = page.getByRole('navigation', { name: /application steps/i });
      await expect(nav).toHaveCount(1);
      await expect(nav).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Sidebar step list semantics: list / listitem / aria-current / aria-label
  // (spec: portal-sidebar.tsx — role="list"/role="listitem", aria-current
  //  on active step, aria-label "Step X of 9: name — status")
  // -----------------------------------------------------------------------

  test.describe('Sidebar step list semantics', () => {
    test('sidebar contains a role="list" with role="listitem" entries', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const nav = page.getByRole('navigation', { name: /application steps/i });

      const list = nav.getByRole('list');
      await expect(list).toHaveCount(1);

      // At least one listitem per step. Real count varies by package shape;
      // the assertion only requires that the list mechanism is in use.
      const listItems = list.getByRole('listitem');
      expect(await listItems.count()).toBeGreaterThan(0);
    });

    test('the active step item carries aria-current="step" and only the active step does', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Initially the first step is active.
      const items = page.locator('[data-testid="section-item"], [data-testid="review-submit-item"]');
      const firstItem = items.first();

      // Only one element on the page has aria-current="step".
      const currentItems = page.locator('[aria-current="step"]');
      await expect(currentItems).toHaveCount(1);

      // ...and it is the active one.
      await expect(firstItem).toHaveAttribute('aria-current', 'step');

      // Click a different step; aria-current must move with the active state.
      const secondItem = items.nth(1);
      await secondItem.click();
      await expect(secondItem).toHaveAttribute('aria-current', 'step');
      await expect(firstItem).not.toHaveAttribute('aria-current', 'step');
      await expect(currentItems).toHaveCount(1);
    });

    test('each step item exposes an aria-label including step number, name, and status', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx — 'Step 3 of 9: Address History — complete'
      // or 'Step 5 of 9: Employment — not started'.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const items = page.locator('[data-testid="section-item"], [data-testid="review-submit-item"]');
      const total = await items.count();
      expect(total).toBeGreaterThan(1);

      for (let i = 0; i < total; i += 1) {
        const item = items.nth(i);

        // Either the listitem itself or its inner button (whichever holds
        // the accessible name) must expose an aria-label matching the
        // "Step X of N: <name> — <status>" pattern.
        const ariaLabel =
          (await item.getAttribute('aria-label')) ||
          (await item.locator('button, [role="button"], a').first().getAttribute('aria-label'));

        expect(ariaLabel, `Step ${i + 1} aria-label missing`).not.toBeNull();
        // Number prefix + total.
        expect(ariaLabel!).toMatch(/Step\s+\d+\s+of\s+\d+/i);
        // Status suffix — one of Complete / Has errors / Not started.
        expect(ariaLabel!).toMatch(/complete|has errors|not started/i);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Mobile drawer accessibility
  // (spec: portal-sidebar.tsx — aria-modal=true, role=dialog,
  //  aria-label="Application steps menu" when open;
  //  hamburger aria-expanded + aria-controls; focus trap; Escape closes;
  //  overlay click closes)
  // -----------------------------------------------------------------------

  test.describe('Mobile drawer accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Tests in this describe block run on a mobile viewport.
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('hamburger button exposes aria-expanded that toggles, plus aria-controls referencing the drawer id', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx — hamburger menu button needs
      // aria-expanded="true/false" and aria-controls pointing to the
      // drawer's id.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const hamburger = page.locator('[data-testid="hamburger-menu"]');
      await expect(hamburger).toBeVisible();

      // Closed state.
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

      // aria-controls must point at an element id that actually exists.
      const controlsId = await hamburger.getAttribute('aria-controls');
      expect(controlsId, 'hamburger aria-controls').not.toBeNull();
      expect(controlsId!.length).toBeGreaterThan(0);
      const controlled = page.locator(`#${controlsId}`);
      await expect(controlled).toHaveCount(1);

      // Open the drawer.
      await hamburger.click();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

      // The element referenced by aria-controls is now visible.
      await expect(controlled).toBeVisible();
    });

    test('opened mobile drawer exposes role="dialog", aria-modal="true", aria-label="Application steps menu"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      await page.locator('[data-testid="hamburger-menu"]').click();

      const dialog = page.getByRole('dialog', { name: /application steps menu/i });
      await expect(dialog).toHaveCount(1);
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    test('Escape key closes the mobile drawer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx — "this behavior must also work via
      // keyboard (Escape key)"; New File #4 (useKeyboardNavigation) —
      // Escape closes the mobile sidebar drawer if open.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const hamburger = page.locator('[data-testid="hamburger-menu"]');
      await hamburger.click();

      const drawer = page.locator('[data-testid="mobile-sidebar"]');
      await expect(drawer).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(drawer).not.toBeVisible();
      // hamburger aria-expanded follows the drawer state.
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    });

    test('clicking the overlay closes the mobile drawer', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx — overlay click closes the drawer.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      await page.locator('[data-testid="hamburger-menu"]').click();

      const drawer = page.locator('[data-testid="mobile-sidebar"]');
      await expect(drawer).toBeVisible();

      await page.locator('[data-testid="mobile-overlay"]').click();

      await expect(drawer).not.toBeVisible();
    });

    test('mobile drawer traps Tab key — Tab cycles among items inside the drawer, never the page behind', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-sidebar.tsx — "when it's open, Tab should cycle
      // through only the items inside the drawer, not escape to the page
      // behind it".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const hamburger = page.locator('[data-testid="hamburger-menu"]');
      await hamburger.click();

      const drawer = page.locator('[data-testid="mobile-sidebar"]');
      await expect(drawer).toBeVisible();

      // Tab through every focusable element a generous number of times.
      // After EVERY Tab, the focused element must live inside the drawer.
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Tab');
        const focusedInsideDrawer = await drawer.evaluate(
          (el) => !!document.activeElement && el.contains(document.activeElement)
        );
        expect(focusedInsideDrawer, `Tab #${i + 1} escaped the drawer`).toBe(true);
      }

      // Shift+Tab in the other direction also must stay inside the drawer.
      for (let i = 0; i < 25; i += 1) {
        await page.keyboard.press('Shift+Tab');
        const focusedInsideDrawer = await drawer.evaluate(
          (el) => !!document.activeElement && el.contains(document.activeElement)
        );
        expect(focusedInsideDrawer, `Shift+Tab #${i + 1} escaped the drawer`).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Focus management on step navigation
  // (spec: portal-layout.tsx — useFocusManagement moves focus to the new
  //  step's heading after step change; StepHeading is the focus target)
  // -----------------------------------------------------------------------

  test.describe('Focus management on step navigation', () => {
    test('focus moves to the new step heading after the candidate clicks Next', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #3 (useFocusManagement) + New File #2 (StepHeading) +
      // portal-layout.tsx modification.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const next = page.locator('[data-testid="step-nav-next"]');
      await next.click();

      // After navigation, the page has an h2 step heading and it is the
      // active focus target. The heading must be focusable (tabIndex=-1)
      // so .focus() works.
      const heading = page.locator('main h2, [role="main"] h2').first();
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
    });

    test('focus moves to the new step heading after the candidate clicks Back', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: same as above.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      await page.locator('[data-testid="step-nav-next"]').click();
      // After step 2 has rendered, click Back.
      await page.locator('[data-testid="step-nav-back"]').click();

      const heading = page.locator('main h2, [role="main"] h2').first();
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
    });

    test('focus moves to the new step heading after the candidate selects a step from the sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #3 — focus moves to the step heading when a
      // candidate clicks Next/Back OR selects a step from the sidebar.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const items = page.locator('[data-testid="section-item"], [data-testid="review-submit-item"]');
      await items.nth(2).click();

      const heading = page.locator('main h2, [role="main"] h2').first();
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
    });

    test('every step heading is an <h2> with a unique id', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #2 — StepHeading "renders the step title as an
      // <h2> with a unique id".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const items = page.locator('[data-testid="section-item"], [data-testid="review-submit-item"]');
      const total = await items.count();
      const seenIds = new Set<string>();

      for (let i = 0; i < total; i += 1) {
        await items.nth(i).click();
        const heading = page.locator('main h2, [role="main"] h2').first();
        await expect(heading).toBeVisible();
        const id = await heading.getAttribute('id');
        expect(id, `Step ${i + 1} heading is missing an id`).not.toBeNull();
        expect(id!.length).toBeGreaterThan(0);
        expect(seenIds.has(id!), `Step ${i + 1} heading id "${id}" is not unique`).toBe(false);
        seenIds.add(id!);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Live announcer (LiveAnnouncer component)
  // (spec: New File #5 — invisible aria-live="polite" region used by
  //  portal-layout, PersonalInfoSection, address history section, record
  //  search section, and Next/Back validation handlers)
  // -----------------------------------------------------------------------

  test.describe('Live announcer (aria-live="polite")', () => {
    test('an aria-live="polite" region is rendered once on the portal', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: New File #5 — "renders a hidden <div> with
      // aria-live='polite'". Rendered once at the top of portal-layout.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const region = page.locator('[aria-live="polite"]');
      await expect(region).toHaveCount(1);
    });

    test('"Progress saved" is announced after auto-save completes', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: portal-layout.tsx — "When auto-save completes, push an
      // announcement ('Progress saved') to the live announcer".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Navigate to Personal Info and edit a field so auto-save fires on
      // blur (the existing auto-save behaviour from prior phases).
      await gotoSection(page, /Personal Info/i);

      const firstInput = page.locator('main input, [role="main"] input').first();
      await firstInput.fill('Test value 12345');
      await firstInput.blur();

      // The live region eventually contains the announcement. Use
      // expect.poll so the timing tolerates the auto-save debounce.
      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 10_000 })
        .toMatch(/progress saved/i);
    });

    test('"Cannot continue — X fields need attention" is announced when Next is pressed on a step with validation errors', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #11 (Next/Back) — "When a step has validation
      // errors and the candidate presses Next, announce 'Cannot continue
      // — X fields need attention' via the live announcer and move focus
      // to the first field with an error".
      await loginToPortal(page, TOKEN_WITH_PERSONAL_INFO_ERROR);

      await gotoSection(page, /Personal Info/i);

      // Submit / Next on a section with required-field errors.
      await page.locator('[data-testid="step-nav-next"]').click();

      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 5_000 })
        .toMatch(/cannot continue[\s\S]*fields? need attention/i);
    });

    test('"New required fields have been added" is announced when Personal Info gains fields after going back and changing a country', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: PersonalInfoSection — "When fields are dynamically added
      // (because the candidate went back and changed a country), announce
      // 'New required fields have been added' via the live announcer".
      await loginToPortal(page, TOKEN_PERSONAL_INFO_DYNAMIC_ADD);

      // Pre-condition: open Personal Info once so any baseline fields are
      // rendered, then navigate back to Address History and change a
      // country selection (the implementation owns which field triggers
      // the new subject-targeted requirement).
      await gotoSection(page, /Personal Info/i);
      await gotoSection(page, /Address History/i);

      // Trigger a country change that adds a new subject-targeted field
      // — the implementation owns the exact selector but the candidate
      // workflow conventionally uses a country select.
      const countrySelect = page.locator('main select, [role="main"] select').first();
      // Pick a country that introduces a Personal Info field; the seeded
      // token guarantees a non-default option exists.
      await countrySelect.selectOption({ index: 1 });

      // Return to Personal Info; the live region must announce the new fields.
      await gotoSection(page, /Personal Info/i);

      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 5_000 })
        .toMatch(/new required fields have been added/i);
    });

    test('"Requirements have been updated" is announced when Record Search recalculates silently', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Record Search Requirements section — "When fields
      // recalculate silently (because the candidate changed addresses),
      // announce 'Requirements have been updated' via the live announcer".
      await loginToPortal(page, TOKEN_RECORD_SEARCH_RECALC);

      // Change an address country so the record search aggregation
      // recalculates.
      await gotoSection(page, /Address History/i);
      const countrySelect = page.locator('main select, [role="main"] select').first();
      await countrySelect.selectOption({ index: 1 });

      // Open Record Search Requirements; the silent recalc announcement
      // must already be (or eventually be) in the live region.
      await gotoSection(page, /Record Search|Record Search Requirements/i);

      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 5_000 })
        .toMatch(/requirements have been updated/i);
    });
  });

  // -----------------------------------------------------------------------
  // Next / Back button accessibility
  // (spec: Existing File #11 — descriptive aria-labels, 44px min targets;
  //  focus-to-first-error on failed Next validation)
  // -----------------------------------------------------------------------

  test.describe('Next / Back button accessibility', () => {
    test('Back button aria-label describes the destination step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #11 — aria-label="Go back to Step X: [Step Name]".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Move past the first step so a Back button is rendered.
      await page.locator('[data-testid="step-nav-next"]').click();

      const back = page.locator('[data-testid="step-nav-back"]');
      await expect(back).toBeVisible();

      const label = await back.getAttribute('aria-label');
      expect(label, 'Back button aria-label').not.toBeNull();
      // Must include "Step <number>:" and "Go back".
      expect(label!).toMatch(/Go back to Step\s+\d+:\s+.+/i);
    });

    test('Next button aria-label describes the destination step', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #11 — aria-label="Continue to Step X: [Step Name]".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const next = page.locator('[data-testid="step-nav-next"]');
      await expect(next).toBeVisible();

      const label = await next.getAttribute('aria-label');
      expect(label, 'Next button aria-label').not.toBeNull();
      expect(label!).toMatch(/Continue to Step\s+\d+:\s+.+/i);
    });

    test('on failed Next-validation, focus moves to the first field with an error', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #11 — "...move focus to the first field with
      // an error".
      await loginToPortal(page, TOKEN_WITH_PERSONAL_INFO_ERROR);

      await gotoSection(page, /Personal Info/i);

      await page.locator('[data-testid="step-nav-next"]').click();

      // After failed validation, exactly one element on the page is the
      // active element AND it carries aria-invalid="true". (The first
      // errored field is the focus target per spec.)
      const focusedInvalid = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        return el.getAttribute('aria-invalid') === 'true';
      });
      expect(focusedInvalid, 'focused element should be aria-invalid="true"').toBe(true);
    });

    test('Next and Back buttons meet the 44px minimum touch target on mobile', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #11 — "Both buttons must meet the 44px minimum
      // touch target size".
      await page.setViewportSize({ width: 375, height: 667 });
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Move off the first step so both buttons render in the same row.
      await page.locator('[data-testid="step-nav-next"]').click();

      const next = page.locator('[data-testid="step-nav-next"]');
      const back = page.locator('[data-testid="step-nav-back"]');

      const nextBox = await next.boundingBox();
      const backBox = await back.boundingBox();
      expect(nextBox, 'Next button has a bounding box').not.toBeNull();
      expect(backBox, 'Back button has a bounding box').not.toBeNull();
      expect(nextBox!.height).toBeGreaterThanOrEqual(44);
      expect(backBox!.height).toBeGreaterThanOrEqual(44);
    });
  });

  // -----------------------------------------------------------------------
  // SectionProgressIndicator accessibility
  // (spec: Existing File #3 — sr-only status text; decorative icon
  //  aria-hidden; distinct icon shape per state, not color-only)
  // -----------------------------------------------------------------------

  test.describe('SectionProgressIndicator accessibility', () => {
    test('every progress indicator includes sr-only status text matching one of the three statuses', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #3 — "<span className='sr-only'>" with one of
      // "Complete", "Has errors", "Not started".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const indicators = page.locator('[data-testid="section-progress-indicator"]');
      const total = await indicators.count();
      expect(total).toBeGreaterThan(0);

      for (let i = 0; i < total; i += 1) {
        const indicator = indicators.nth(i);
        const srOnly = indicator.locator('.sr-only');
        await expect(srOnly).toHaveCount(1);
        const text = (await srOnly.textContent())?.trim() ?? '';
        expect(text).toMatch(/^(Complete|Has errors|Not started)$/);
      }
    });

    test('decorative SVG / icon inside each indicator is aria-hidden="true"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #3 — "Add aria-hidden='true' to the decorative
      // icon element itself".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const indicators = page.locator('[data-testid="section-progress-indicator"]');
      const total = await indicators.count();

      for (let i = 0; i < total; i += 1) {
        // The decorative element is whatever element renders the icon —
        // typically an <svg> or a <span> with the icon class. The spec
        // mandates aria-hidden="true" on the decorative element.
        const decorative = indicators.nth(i).locator('[aria-hidden="true"]').first();
        await expect(decorative).toHaveCount(1);
      }
    });

    test('each indicator status produces a distinct icon shape (not color-only)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #3 — "Add a distinct icon shape for each state
      // so color isn't the only signal".
      //
      // The test confirms that the implementation differentiates the three
      // states by something other than color — namely, a status-bearing
      // attribute that the implementer can hang shape selection off of.
      // The existing portal-shell suite already asserts data-status on
      // section-status; here we require the same on the indicator itself
      // so screen readers and CSS-disabled themes both work.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const indicators = page.locator('[data-testid="section-progress-indicator"]');
      const total = await indicators.count();
      const seenStatuses = new Set<string>();

      for (let i = 0; i < total; i += 1) {
        const status = await indicators.nth(i).getAttribute('data-status');
        expect(status, `Indicator ${i} data-status`).not.toBeNull();
        seenStatuses.add(status!);
      }

      // Every observed status value is one of the three allowed values.
      for (const status of seenStatuses) {
        expect(['complete', 'incomplete', 'not_started']).toContain(status);
      }
    });
  });

  // -----------------------------------------------------------------------
  // WorkflowSectionRenderer accessibility
  // (spec: Existing File #4 — wrap in role="document" with aria-label
  //  set to section title and tabIndex=0)
  // -----------------------------------------------------------------------

  test.describe('WorkflowSectionRenderer accessibility', () => {
    test('a workflow section (e.g. Welcome) renders inside a role="document" container with aria-label and tabIndex=0', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #4 — "Wrap the rendered HTML in a container
      // with role='document' and aria-label set to the section title…
      // Add tabIndex={0} to the container".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // The first step in the 9-step flow is a before_services workflow
      // section (the spec calls out Welcome). Selecting the first item
      // lands on a workflow section.
      const firstItem = page.locator('[data-testid="section-item"]').first();
      await firstItem.click();

      const docs = page.locator('main [role="document"], [role="main"] [role="document"]');
      await expect(docs).toHaveCount(1);

      const doc = docs.first();
      const label = await doc.getAttribute('aria-label');
      expect(label, 'role=document aria-label').not.toBeNull();
      expect(label!.length).toBeGreaterThan(0);

      // tabIndex=0 (allow string '0' since DOM attributes are strings).
      const tabIndex = await doc.getAttribute('tabindex');
      expect(tabIndex).toBe('0');
    });
  });

  // -----------------------------------------------------------------------
  // PersonalInfo form-field accessibility
  // (spec: PersonalInfoSection — visible <label> with matching htmlFor/id,
  //  aria-required on required fields, aria-invalid + aria-describedby on
  //  errored fields)
  // -----------------------------------------------------------------------

  test.describe('PersonalInfo form-field accessibility', () => {
    test('every Personal Info input has a matching <label htmlFor> / <input id> pair', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: PersonalInfoSection — "Ensure every form field has a
      // visible <label> element with a matching htmlFor/id pair".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      await gotoSection(page, /Personal Info/i);

      const inputs = page.locator('main input, [role="main"] input');
      const total = await inputs.count();
      expect(total).toBeGreaterThan(0);

      for (let i = 0; i < total; i += 1) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        expect(id, `Personal Info input #${i} missing id`).not.toBeNull();
        // A <label> with htmlFor exactly equal to the input id must exist.
        const label = page.locator(`label[for="${id}"]`);
        await expect(label, `<label for="${id}"> is missing`).toHaveCount(1);
        await expect(label).toBeVisible();
      }
    });

    test('every required Personal Info field carries aria-required="true"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: PersonalInfoSection — "Add aria-required='true' to all
      // required fields".
      await loginToPortal(page, TOKEN_WITH_PERSONAL_INFO_ERROR);

      await gotoSection(page, /Personal Info/i);

      // The token guarantees at least one required field is present.
      const required = page.locator('main [aria-required="true"], [role="main"] [aria-required="true"]');
      expect(await required.count()).toBeGreaterThan(0);
    });

    test('on failed validation, errored Personal Info fields carry aria-invalid="true" and aria-describedby pointing to a visible error message', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: PersonalInfoSection — "Add aria-invalid='true' to fields
      // that have validation errors; Add aria-describedby linking each
      // field to its error message (if any)".
      await loginToPortal(page, TOKEN_WITH_PERSONAL_INFO_ERROR);

      await gotoSection(page, /Personal Info/i);

      // Trigger validation by pressing Next on a section with required
      // fields left blank.
      await page.locator('[data-testid="step-nav-next"]').click();

      const invalid = page.locator('main [aria-invalid="true"], [role="main"] [aria-invalid="true"]');
      const count = await invalid.count();
      expect(count).toBeGreaterThan(0);

      // For at least the first invalid field, aria-describedby points to
      // an existing visible element on the page.
      const firstInvalid = invalid.first();
      const describedBy = await firstInvalid.getAttribute('aria-describedby');
      expect(describedBy, 'aria-describedby on invalid field').not.toBeNull();
      // describedBy can be a space-separated list of ids; check the first.
      const ids = describedBy!.trim().split(/\s+/);
      expect(ids.length).toBeGreaterThan(0);
      const errorEl = page.locator(`#${ids[0]}`);
      await expect(errorEl).toHaveCount(1);
      await expect(errorEl).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------
  // Address History accessibility
  // (spec: Existing File #6 — fieldset/legend per entry, descriptive
  //  aria-labels, focus moves to first field of new entry on Add and to
  //  previous entry on Remove, gap warning announced)
  // -----------------------------------------------------------------------

  test.describe('Address History accessibility', () => {
    test('each address entry is wrapped in a <fieldset> with a <legend> like "Address N"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — fieldset/legend pattern.
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      const fieldsets = page.locator('main fieldset, [role="main"] fieldset');
      const total = await fieldsets.count();
      expect(total).toBeGreaterThan(0);

      // At least one fieldset has a legend matching "Address 1".
      const first = fieldsets.first();
      const legend = first.locator('legend');
      await expect(legend).toHaveCount(1);
      const legendText = (await legend.textContent())?.trim() ?? '';
      expect(legendText).toMatch(/Address\s+1/i);
    });

    test('"Add another address entry" button has a descriptive aria-label', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — Add button aria-label "Add another
      // address entry".
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      const addBtn = page.getByRole('button', { name: /add another address entry/i });
      await expect(addBtn).toBeVisible();
    });

    test('"Remove address N" buttons have entry-specific aria-labels', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — "Remove address 3" (not just "Remove").
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      // Add a second entry so two Remove buttons exist.
      await page.getByRole('button', { name: /add another address entry/i }).click();

      const remove1 = page.getByRole('button', { name: /remove address 1/i });
      const remove2 = page.getByRole('button', { name: /remove address 2/i });
      await expect(remove1).toHaveCount(1);
      await expect(remove2).toHaveCount(1);
    });

    test('date fields carry context-aware aria-labels like "Start date for address 1"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — Date fields aria-label "Start date for
      // address 1".
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      const startDate = page.getByLabel(/start date for address 1/i);
      const endDate = page.getByLabel(/end date for address 1/i);
      await expect(startDate).toHaveCount(1);
      await expect(endDate).toHaveCount(1);
    });

    test('after Add, focus moves to the first field of the newly created entry', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — "When a new entry is added, focus should
      // move to the first field of the new entry".
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      // Determine how many fieldsets exist before clicking Add.
      const fieldsetsBefore = await page.locator('main fieldset, [role="main"] fieldset').count();

      await page.getByRole('button', { name: /add another address entry/i }).click();

      const fieldsets = page.locator('main fieldset, [role="main"] fieldset');
      await expect(fieldsets).toHaveCount(fieldsetsBefore + 1);

      // The new entry is the last fieldset; the active element must live
      // inside it and be its first focusable input.
      const newEntry = fieldsets.last();
      const firstFocusableInNew = newEntry
        .locator('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
        .first();
      await expect(firstFocusableInNew).toBeFocused();
    });

    test('after Remove, focus moves to the previous entry (or the Add button if the removed entry was the only one)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — "When an entry is removed, focus should
      // move to the previous entry's first field (or the 'Add' button if
      // it was the only entry)".
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      // Make sure there are at least 2 entries.
      await page.getByRole('button', { name: /add another address entry/i }).click();

      // Remove the second entry.
      await page.getByRole('button', { name: /remove address 2/i }).click();

      const fieldsets = page.locator('main fieldset, [role="main"] fieldset');
      const remaining = await fieldsets.count();
      expect(remaining).toBeGreaterThan(0);

      // Focus must now live inside the previous (now last) entry's first
      // focusable field.
      const prevEntry = fieldsets.last();
      const firstFocusableInPrev = prevEntry
        .locator('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
        .first();
      await expect(firstFocusableInPrev).toBeFocused();
    });

    test('address gap-tolerance warning is announced via the live region', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #6 — "Gap tolerance warnings need to be
      // announced via the live announcer".
      await loginToPortal(page, TOKEN_ADDRESS_HISTORY_MULTI);

      await gotoSection(page, /Address History/i);

      // The seeded token guarantees the addresses entered produce a gap.
      // The implementation's gap-check fires on blur of the affected date
      // field; simply focusing and blurring the start-date input is
      // sufficient to retrigger validation.
      const startDate = page.getByLabel(/start date for address 1/i);
      await startDate.focus();
      await startDate.blur();

      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 5_000 })
        .toMatch(/gap/i);
    });
  });

  // -----------------------------------------------------------------------
  // Education and Employment accessibility
  // (spec: Existing Files #7 + #8 — same fieldset/legend, focus, aria
  //  patterns; employment gap entries have specific legend formatting)
  // -----------------------------------------------------------------------

  test.describe('Education section accessibility', () => {
    test('each education entry is wrapped in <fieldset> with a "Education entry N" <legend>', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #7.
      await loginToPortal(page, TOKEN_EDUCATION_SCOPE);

      await gotoSection(page, /Education/i);

      const firstLegend = page
        .locator('main fieldset, [role="main"] fieldset')
        .first()
        .locator('legend');
      await expect(firstLegend).toHaveCount(1);
      expect(((await firstLegend.textContent()) ?? '').trim()).toMatch(/Education entry\s+1/i);
    });

    test('"Add another education entry" and "Remove education entry N" buttons have descriptive aria-labels', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #7 — "same aria-label patterns".
      await loginToPortal(page, TOKEN_EDUCATION_SCOPE);

      await gotoSection(page, /Education/i);

      const add = page.getByRole('button', { name: /add another education entry/i });
      await expect(add).toBeVisible();

      // Force at least 2 entries for the remove-N label check.
      await add.click();
      await expect(page.getByRole('button', { name: /remove education entry 1/i })).toHaveCount(1);
      await expect(page.getByRole('button', { name: /remove education entry 2/i })).toHaveCount(1);
    });

    test('Education scope validation message ("You need exactly 2 education entries") is announced via the live region', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #7 — "Scope validation messages … announced
      // via live announcer".
      await loginToPortal(page, TOKEN_EDUCATION_SCOPE);

      await gotoSection(page, /Education/i);

      // Press Next without satisfying the scope (the seeded token has 0
      // entries to start with — exactly 2 are required).
      await page.locator('[data-testid="step-nav-next"]').click();

      await expect
        .poll(async () => readLiveAnnouncement(page), { timeout: 5_000 })
        .toMatch(/(exactly\s+2\s+education\s+entries|need\s+\d+\s+more\s+education)/i);
    });
  });

  test.describe('Employment section accessibility', () => {
    test('each employment entry is wrapped in <fieldset> with an "Employment entry N" <legend>', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #8.
      await loginToPortal(page, TOKEN_EMPLOYMENT_GAP);

      await gotoSection(page, /Employment/i);

      const employmentLegends = page.locator('main fieldset legend, [role="main"] fieldset legend');
      const total = await employmentLegends.count();
      expect(total).toBeGreaterThan(0);

      // At least one legend matches "Employment entry N".
      let foundEmploymentEntryLegend = false;
      for (let i = 0; i < total; i += 1) {
        const text = ((await employmentLegends.nth(i).textContent()) ?? '').trim();
        if (/Employment entry\s+\d+/i.test(text)) {
          foundEmploymentEntryLegend = true;
          break;
        }
      }
      expect(foundEmploymentEntryLegend).toBe(true);
    });

    test('Employment gap entries are wrapped in <fieldset> with a "Employment gap — <start> to <end>" <legend>', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #8 — "Employment gap entries need their own
      // fieldset with a legend that indicates they're gap entries:
      // 'Employment gap — June 2024 to September 2024'".
      await loginToPortal(page, TOKEN_EMPLOYMENT_GAP);

      await gotoSection(page, /Employment/i);

      const legends = page.locator('main fieldset legend, [role="main"] fieldset legend');
      const total = await legends.count();

      let foundGapLegend = false;
      for (let i = 0; i < total; i += 1) {
        const text = ((await legends.nth(i).textContent()) ?? '').trim();
        // Format: "Employment gap — <something> to <something>". The dash
        // can be em dash (—), en dash (–), or hyphen (-) depending on
        // i18n; accept any.
        if (/Employment gap\s*[—–-]\s*.+\s+to\s+.+/i.test(text)) {
          foundGapLegend = true;
          break;
        }
      }
      expect(foundGapLegend).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Review & Submit accessibility
  // (spec: Existing File #10 — h3 per section, role="alert" summary,
  //  descriptive jump-link aria-labels, Submit aria-disabled +
  //  aria-describedby)
  // -----------------------------------------------------------------------

  test.describe('Review & Submit accessibility', () => {
    test('Review & Submit shows an <h3> for each section summary block', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #10 — "Each section summary block needs an
      // accessible heading (h3) with the section name".
      await loginToPortal(page, TOKEN_REVIEW_WITH_ERRORS);

      await gotoSection(page, /Review/i);

      const sectionHeadings = page.locator('main h3, [role="main"] h3');
      expect(await sectionHeadings.count()).toBeGreaterThan(0);
    });

    test('validation summary banner has role="alert" when errors exist', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #10 — "The overall validation summary at the
      // top needs role='alert' so it's immediately announced when errors
      // exist".
      await loginToPortal(page, TOKEN_REVIEW_WITH_ERRORS);

      await gotoSection(page, /Review/i);

      // role="alert" is implicitly the WAI-ARIA "alert" role.
      const alerts = page.getByRole('alert');
      expect(await alerts.count()).toBeGreaterThan(0);
    });

    test('"Jump to section" links have descriptive aria-labels like "Go back to fix errors in <section>"', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #10 — jump-link aria-label "Go back to fix
      // errors in Address History".
      await loginToPortal(page, TOKEN_REVIEW_WITH_ERRORS);

      await gotoSection(page, /Review/i);

      const jumpLinks = page.getByRole('link', { name: /go back to fix errors in .+/i });
      expect(await jumpLinks.count()).toBeGreaterThan(0);
    });

    test('Submit button is aria-disabled="true" when the form is incomplete and aria-describedby points to the explanation text', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: Existing File #10 — Submit aria-disabled (not just visual
      // graying) + aria-describedby pointing to text that explains why.
      await loginToPortal(page, TOKEN_REVIEW_WITH_ERRORS);

      await gotoSection(page, /Review/i);

      const submit = page.getByRole('button', { name: /^submit/i });
      await expect(submit).toHaveCount(1);
      await expect(submit).toHaveAttribute('aria-disabled', 'true');

      const describedBy = await submit.getAttribute('aria-describedby');
      expect(describedBy, 'Submit aria-describedby').not.toBeNull();
      const explainEl = page.locator(`#${describedBy}`);
      await expect(explainEl).toHaveCount(1);
      await expect(explainEl).toHaveText(/complete all required sections before submitting/i);
    });
  });

  // -----------------------------------------------------------------------
  // Global stylesheet accessibility
  // (spec: globals.css — :focus-visible outline, sr-only utility,
  //  prefers-reduced-motion media query)
  // -----------------------------------------------------------------------

  test.describe('Global stylesheet accessibility', () => {
    test('keyboard focus produces a visible outline on interactive elements (:focus-visible)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: globals.css — "outline: 2px solid #3b82f6; outline-offset:
      // 2px on :focus-visible".
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Tab onto the SkipLink first; it's the first focusable element
      // after Task 9.2 lands.
      await page.keyboard.press('Tab');

      // Then move focus to the next interactive element with another Tab
      // so we're past the SkipLink and onto something inside the page UI.
      await page.keyboard.press('Tab');

      const outlineStyles = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
        };
      });

      expect(outlineStyles, 'focused element returns a computed style').not.toBeNull();
      // outlineStyle must be something other than 'none'.
      expect(outlineStyles!.outlineStyle).not.toBe('none');
      // outlineWidth parses to > 0 px.
      expect(parseFloat(outlineStyles!.outlineWidth)).toBeGreaterThan(0);
    });

    test('a .sr-only utility class exists and renders zero-area visually-hidden content', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: globals.css — "Add a sr-only utility class if one doesn't
      // already exist". SectionProgressIndicator's status text uses it,
      // so by asserting on that we also cover the class existence.
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      const srEl = page.locator('.sr-only').first();
      await expect(srEl).toBeAttached();

      // The element renders in the DOM but has effectively zero visible
      // area (the classic clip-rect / 1px implementation).
      const box = await srEl.boundingBox();
      // Either zero box, or 1x1 box per the WAI-ARIA Authoring Practices
      // sr-only pattern.
      if (box) {
        expect(box.width).toBeLessThanOrEqual(2);
        expect(box.height).toBeLessThanOrEqual(2);
      }
    });

    test('with prefers-reduced-motion: reduce, animation and transition durations on portal elements are <= 0.01s', async ({ page, browserName }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec: globals.css — "Add a prefers-reduced-motion media query
      // that disables animations/transitions for users who have turned on
      // 'reduce motion' in their OS settings".
      //
      // Playwright's emulateMedia({ reducedMotion: 'reduce' }) is the
      // canonical way to flip the media query in tests.
      // (browserName argument retained for future per-engine assertions
      //  but every supported browser supports the emulation.)
      void browserName;

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await loginToPortal(page, FULL_PACKAGE_TOKEN);

      // Sample a handful of interactive / structural elements that the
      // pre-9.2 portal animates (Next button, hamburger button on mobile
      // viewport, sidebar entries) and confirm the computed transition /
      // animation durations are effectively zero.
      const durations = await page.evaluate(() => {
        const selectors = [
          '[data-testid="step-nav-next"]',
          '[data-testid="section-item"]',
        ];
        const results: { selector: string; transition: string; animation: string }[] = [];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (!el) continue;
          const cs = window.getComputedStyle(el);
          results.push({
            selector: sel,
            transition: cs.transitionDuration,
            animation: cs.animationDuration,
          });
        }
        return results;
      });

      expect(durations.length).toBeGreaterThan(0);

      const parseMaxSeconds = (composite: string): number => {
        // computed style returns "0.2s, 0s, 0.5s" or "0.2s"; take the max.
        return composite
          .split(',')
          .map((s) => s.trim())
          .map((s) => (s.endsWith('ms') ? parseFloat(s) / 1000 : parseFloat(s)))
          .filter((n) => !Number.isNaN(n))
          .reduce((max, cur) => Math.max(max, cur), 0);
      };

      for (const d of durations) {
        expect(
          parseMaxSeconds(d.transition),
          `${d.selector} transitionDuration under prefers-reduced-motion`
        ).toBeLessThanOrEqual(0.01);
        expect(
          parseMaxSeconds(d.animation),
          `${d.selector} animationDuration under prefers-reduced-motion`
        ).toBeLessThanOrEqual(0.01);
      }
    });
  });
});
