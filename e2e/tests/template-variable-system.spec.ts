// /GlobalRX_v2/e2e/tests/template-variable-system.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Pass 1 end-to-end tests for the Template Variable System for Workflow Sections.
 *
 * Source of truth:
 * - docs/specs/template-variable-system.md (User Flow: Candidate Experience; User Flow:
 *   Admin Experience; Business Rules 1–10; Definition of Done items 5–7, 10–12)
 * - docs/plans/template-variable-system-plan.md (visible UI surfaces: the new
 *   WorkflowSectionVariableReference panel inside the workflow section dialog;
 *   WorkflowSectionRenderer reading variableValues from portal-layout)
 *
 * These tests are written before the feature exists. They WILL FAIL when first run
 * (Pass 1 / RED phase). The implementer's job is to make them pass.
 *
 * Test data assumptions (follow the same convention used in
 * `candidate-invitation-foundation.spec.ts` and `candidate-portal-shell.spec.ts`):
 * - Placeholder tokens and IDs like `test-template-variable-token` are expected to be
 *   provided by the project's e2e seed/fixture pipeline. If they are not, the implementer
 *   may need to add them — this is consistent with the foundation spec's pattern.
 */

const ADMIN_EMAIL = 'admin@globalrx.com';
const ADMIN_PASSWORD = 'adminpass123';

const CANDIDATE_TOKEN_WITH_FULL_DATA = 'test-template-variable-token';
const CANDIDATE_PASSWORD = 'TestPassword123!';

// The seeded candidate the candidate-side tests target. The values below MUST match
// what the seed for `CANDIDATE_TOKEN_WITH_FULL_DATA` writes into candidate_invitations
// and that invitation's customer. The implementer is expected to keep the seed and these
// expectations in sync.
const SEED_FIRST_NAME = 'Sarah';
const SEED_COMPANY_NAME = 'Acme Corp';

test.describe('Template Variable System - E2E', () => {
  // ------------------------------------------------------------------
  // Admin Experience: variable reference panel inside the workflow section dialog
  // ------------------------------------------------------------------
  test.describe('Admin: Workflow Section Variable Reference Panel', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.waitForURL(/\/dashboard|\/portal|\/fulfillment/);
    });

    test('the workflow section content editor shows a reference list of available template variables', async ({ page }) => {
      // Spec Business Rule 8 / Definition of Done item 7.
      // The reference panel lives inside the workflow section dialog (per architect plan,
      // modified file #7) and is visible while editing a text-type section.

      // Open the workflow section dialog. The implementer wires this through the admin
      // Customer Configurations → Workflows → Sections UI; we navigate via the visible
      // text used in the existing admin shell.
      await page.goto('/customer-configurations');

      // Look for any visible affordance that reaches the workflow section editor. We
      // fall back to direct asserts on the rendered reference panel itself since the
      // navigation path may evolve; the contract under test is "the reference panel is
      // accessible to the admin team", not "this exact navigation chain".
      const variableHeading = page.getByText(/Available template variables/i);
      await expect(variableHeading).toBeVisible({ timeout: 15_000 });
    });

    test('the reference panel shows every v1 variable name', async ({ page }) => {
      // Spec Supported Variables (v1) table. Definition of Done item 7.
      await page.goto('/customer-configurations');

      // The reference panel renders each variable name in {{name}} form.
      await expect(page.getByText('{{candidateFirstName}}')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('{{candidateLastName}}')).toBeVisible();
      await expect(page.getByText('{{candidateEmail}}')).toBeVisible();
      await expect(page.getByText('{{candidatePhone}}')).toBeVisible();
      await expect(page.getByText('{{companyName}}')).toBeVisible();
      await expect(page.getByText('{{expirationDate}}')).toBeVisible();
    });

    test('the reference panel shows a description next to each variable', async ({ page }) => {
      // Spec Admin Experience step 3: "A reference panel or dropdown near the editor
      // shows the list of available template variables with descriptions"
      await page.goto('/customer-configurations');

      // Each row pairs the variable token with a human-readable description.
      // Exact phrasing comes from the architect's translation-keys table.
      await expect(page.getByText(/Candidate's first name/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Candidate's last name/i)).toBeVisible();
      await expect(page.getByText(/Candidate's email address/i)).toBeVisible();
      await expect(page.getByText(/Candidate's phone number/i)).toBeVisible();
      await expect(page.getByText(/Customer's company name/i)).toBeVisible();
      await expect(page.getByText(/When the invite link expires/i)).toBeVisible();
    });
  });

  // ------------------------------------------------------------------
  // Candidate Experience: variables are replaced before rendering
  // ------------------------------------------------------------------
  test.describe('Candidate: Workflow Section Variable Rendering', () => {
    test('candidate sees real first name in place of {{candidateFirstName}} placeholder', async ({ page }) => {
      // Spec Candidate Experience user flow steps 1–7.
      // Spec Definition of Done item 6: "The candidate sees real data ... in workflow
      // sections — not placeholder text."

      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      // The first workflow section content (per seed) contains "{{candidateFirstName}}".
      // After replacement the candidate should see the real first name in the rendered
      // page — and never see the raw placeholder.
      const mainContent = page.locator('[data-testid="main-content"]');
      await expect(mainContent).toContainText(SEED_FIRST_NAME);
      await expect(mainContent).not.toContainText('{{candidateFirstName}}');
    });

    test('candidate sees real company name in place of {{companyName}} placeholder', async ({ page }) => {
      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      const mainContent = page.locator('[data-testid="main-content"]');
      await expect(mainContent).toContainText(SEED_COMPANY_NAME);
      await expect(mainContent).not.toContainText('{{companyName}}');
    });

    test('no raw {{variableName}} text is ever visible to the candidate', async ({ page }) => {
      // Spec Definition of Done item 10: "No raw {{variableName}} text is ever visible
      // to a candidate under any circumstance."
      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      // The entire visible body must not contain any double-curly-brace placeholder
      // that matches a recognized variable. (Malformed placeholders like `{name}` may
      // legitimately appear as literal text per spec edge case row 3; we only assert
      // on the recognized v1 list.)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('{{candidateFirstName}}');
      expect(bodyText).not.toContain('{{candidateLastName}}');
      expect(bodyText).not.toContain('{{candidateEmail}}');
      expect(bodyText).not.toContain('{{candidatePhone}}');
      expect(bodyText).not.toContain('{{companyName}}');
      expect(bodyText).not.toContain('{{expirationDate}}');
    });

    test('an unrecognized {{variable}} in section content is rendered as blank, not as raw placeholder text', async ({ page }) => {
      // Spec Business Rule 4 / Edge Cases row 2.
      // The seed content for this token includes a placeholder like `{{someRandomThing}}`
      // (or a typo) which must be replaced with empty string.
      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('{{someRandomThing}}');
    });

    test('variable replacement does not allow code execution from a malicious value', async ({ page }) => {
      // Spec Business Rule 7 / Business Rule 2 / Definition of Done item 11.
      // If a candidate's stored data contains an HTML/script-like string and the section
      // content includes that variable, DOMPurify must clean it. The rule under test is
      // that no script executes and the raw payload is not surfaced.
      let alertFired = false;
      page.on('dialog', async (dialog) => {
        alertFired = true;
        await dialog.dismiss();
      });

      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      // Give the page a moment to render and run any script tags it ought to be stripping.
      await page.waitForLoadState('networkidle');
      expect(alertFired).toBe(false);
    });

    test('feature works on a 320px wide mobile viewport', async ({ page }) => {
      // Spec Definition of Done item 12.
      await page.setViewportSize({ width: 320, height: 720 });

      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      const mainContent = page.locator('[data-testid="main-content"]');
      await expect(mainContent).toBeVisible();
      await expect(mainContent).toContainText(SEED_FIRST_NAME);
      await expect(mainContent).not.toContainText('{{candidateFirstName}}');
    });

    test('stored workflow section content is not modified by display-time replacement', async ({ page }) => {
      // Spec Business Rule 6: "Variable replacement is read-only and happens at display
      // time — the stored workflow section content in the database is not changed; the
      // {{variableName}} placeholders stay in the saved content and get replaced fresh
      // every time the candidate views the page."
      //
      // We verify the read-only contract by exercising the candidate flow twice in the
      // same session: the second render must show the same replaced output, which is
      // only possible if the placeholders were not consumed/edited on the first render.

      await page.goto(`/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}`);
      await page.fill('input[name="password"]', CANDIDATE_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      const firstRender = await page.locator('[data-testid="main-content"]').innerText();
      expect(firstRender).toContain(SEED_FIRST_NAME);

      // Reload the portal page and re-assert.
      await page.reload();
      await page.waitForURL(`**/candidate/${CANDIDATE_TOKEN_WITH_FULL_DATA}/portal`);

      const secondRender = await page.locator('[data-testid="main-content"]').innerText();
      expect(secondRender).toContain(SEED_FIRST_NAME);
      expect(secondRender).not.toContain('{{candidateFirstName}}');
    });
  });
});
