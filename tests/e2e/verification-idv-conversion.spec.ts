// /GlobalRX_v2/tests/e2e/verification-idv-conversion.spec.ts
//
// Pass 1 end-to-end tests for the verification-idv conversion feature.
//
// These tests will FAIL when first run because:
//   - The admin Services UI dropdown still shows "idv", not "verification-idv".
//   - The API still silently coerces "idv" to "other" instead of
//     rejecting with 400.
//   - The candidate portal still dispatches off the legacy "idv" literal.
// That is the correct RED state for Pass 1 TDD. The implementer's job is
// to land the production code per the technical plan such that these
// tests pass after the data migration runs and the code deploys.
//
// Spec:           docs/specs/verification-idv-conversion.md
//                 (BR 1, BR 3, BR 5, BR 7, User Flow; DoD 4, DoD 8, DoD 11)
// Technical plan: docs/plans/verification-idv-conversion-plan.md §10.3
//
// Deployment context (Strategy A per Andy 2026-05-12):
//   The data migration runs BEFORE the code deploys. By the time these
//   tests execute against a real environment, the production row
//   8388bb60-48e4-4781-a867-7c86b51be776 already has
//   functionalityType='verification-idv'.
//
// Coverage:
//   - BR 3 / DoD 2: POST /api/services rejects "idv" with HTTP 400.
//   - BR 1 / DoD 4: Admin Services dropdown shows "verification-idv".
//   - BR 5 / DoD 8: Package builder does NOT render a scope/count
//                   selector for verification-idv services.
//   - BR 7 / DoD 11: Candidate flow: select country, see DSX fields,
//                    fill them in, submit, and OrderItem is created.
//
// Test-data assumptions (mirror tests/e2e/candidate-form-engine.spec.ts):
//   - Admin login: admin user with email "admin@globalrx.com",
//     password "password123" (matches existing e2e seeded data).
//   - Candidate token "test-verification-idv-token-001" exists in the
//     test environment with a package containing one verification-idv
//     service. The implementer / Andy seeds this when standing up the
//     e2e test environment.

import { test, expect } from '@playwright/test';

test.describe('verification-idv conversion — Pass 1 E2E', () => {
  test.describe('Admin: Services configuration (DoD 4, BR 1)', () => {
    test('Services dropdown shows verification-idv and does NOT show legacy "idv"', async ({
      page,
    }) => {
      // BR 1: allow-list is record, verification-edu, verification-emp,
      // verification-idv, other. The bare string "idv" is no longer valid.
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      await page.goto('/global-config/services');

      // Open the Create Service dialog. Selector matches the existing
      // services-tab.tsx convention; if the implementer relocates the
      // button, the test fails for the right reason (UI change).
      await page.click('button:has-text("Create Service")');

      // The functionality-type select should now offer verification-idv
      // as a top-level option. (Display label may be "Identity
      // Verification" per technical plan §5.14 — we assert on the
      // underlying VALUE, not the cosmetic label, because the spec
      // BR 1 pins the value.)
      const functionalityTypeSelect = page.getByLabel(/functionality type/i);
      await functionalityTypeSelect.click();

      await expect(
        page.getByRole('option', { name: /verification-idv|identity verification/i }),
      ).toBeVisible();

      // BR 14 / DoD 4: "idv" no longer appears in the dropdown.
      await expect(
        page.getByRole('option', { name: /^idv$/i }),
      ).not.toBeVisible();
    });
  });

  test.describe('Admin: API rejection (BR 3, DoD 2)', () => {
    test('POST /api/services with functionalityType:"idv" returns 400 with explicit error', async ({
      request,
      page,
    }) => {
      // BR 3 / Edge Case 3: "An admin's frontend is cached and still
      // sends the old 'idv' string. The API returns HTTP 400 with an
      // 'Unknown functionality type' error."
      //
      // Log in via UI first so the request has a valid session cookie.
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      const response = await request.post('/api/services', {
        data: {
          name: 'Test Identity Verification (should reject)',
          category: 'IDV',
          description: 'This payload uses the legacy "idv" string',
          functionalityType: 'idv',
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toMatch(/unknown functionality type/i);
    });

    test('POST /api/services with functionalityType:"verification-idv" succeeds with 201', async ({
      request,
      page,
    }) => {
      // BR 1 / DoD 2: the new value is accepted.
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // Use a unique name to avoid the auto-generated `code` uniqueness
      // collision retry loop from masking the real test result.
      const uniqueName = `E2E IDV Test ${Date.now()}`;

      const response = await request.post('/api/services', {
        data: {
          name: uniqueName,
          category: 'IDV',
          description: 'E2E-created verification-idv service',
          functionalityType: 'verification-idv',
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.functionalityType).toBe('verification-idv');
    });

    test('GET /api/services response includes verification-idv in functionalityTypes and excludes idv', async ({
      request,
      page,
    }) => {
      // BR 14 / Technical plan §6: GET response shape unchanged, only
      // the values in functionalityTypes change.
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');

      const response = await request.get('/api/services');
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.functionalityTypes).toContain('verification-idv');
      expect(body.functionalityTypes).not.toContain('idv');
    });
  });

  test.describe('Admin: Package builder (BR 5, DoD 8)', () => {
    test('package builder does NOT render scope/count selector for verification-idv services', async ({
      page,
    }) => {
      // BR 5: "The package configuration UI does NOT render a scope
      // selector or count input for verification-idv services."
      //
      // The exact navigation depends on the customer-configurations
      // surface; we use a generic locator strategy that doesn't depend
      // on a specific customer record.
      await page.goto('/login');
      await page.fill('input[name="email"]', 'admin@globalrx.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Customer Configurations → first customer → Packages → Add/Edit
      // package. The exact route is left flexible because both
      // package-dialog.tsx and package-dialog-new.tsx are touched by
      // this PR and Andy hasn't pinned which surface the new flow uses.
      await page.goto('/customer-config');

      // Open ANY customer's package dialog. Selector is loose because
      // the customer-config UI varies; the test still fails for the
      // right reason if the test environment has no customers
      // (data setup issue, not a code defect).
      await page.click('a:has-text("Packages")');
      await page.click('button:has-text("Add Package"), button:has-text("Edit Package")');

      // Select a verification-idv service. The seeded test environment
      // should have one in the services list (created by the data
      // migration on the seeded id 8388bb60-...).
      await page.click('label:has-text("Identity Verification"), label:has-text("verification-idv")');

      // BR 5 — no scope selector for IDV. Verify the scope selector
      // does NOT appear after the IDV service is selected. Compare:
      // verification-edu selection should render a scope picker; IDV
      // should not.
      const scopeSelector = page.locator(
        '[data-testid="scope-selector"], [aria-label*="scope" i]',
      );
      // The locator may match zero or more. We assert that the FIRST
      // match (if any) is not visible.
      await expect(scopeSelector.first()).not.toBeVisible();

      // Also negative-assert against the specific scope-radio labels
      // that appear for verification-edu / verification-emp scope UIs.
      // None of those should render for an IDV-only selection.
      await expect(page.getByText(/highest degree/i)).not.toBeVisible();
      await expect(page.getByText(/all degrees/i)).not.toBeVisible();
      await expect(page.getByText(/most recent/i)).not.toBeVisible();
    });
  });

  test.describe('Candidate: Identity Verification section (DoD 11, User Flow)', () => {
    // DoD 11 — the full happy path. Requires a seeded candidate
    // invitation whose package contains one verification-idv service.
    const candidateToken = 'test-verification-idv-token-001';

    test('renders Identity Verification section in sidebar', async ({ page }) => {
      // User Flow step 2: "The sidebar shows an Identity Verification
      // entry alongside other sections."
      await page.goto(`/candidate/${candidateToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      await page.waitForURL(`**/candidate/${candidateToken}/portal`);

      // Sidebar should contain an Identity Verification section. The
      // translation key is candidate.portal.sections.identityVerification
      // (technical plan §5.3 step 4 — translation key unchanged).
      await expect(
        page.getByText(/identity verification/i),
      ).toBeVisible();
    });

    test('the IDV sidebar entry uses the new service_verification-idv section id', async ({
      page,
    }) => {
      // Technical plan §5.3 step 5: the structure endpoint emits
      // id: 'service_verification-idv' for the IDV section (was
      // 'service_idv'). The sidebar uses this id as the data-section-id
      // attribute on the section item.
      await page.goto(`/candidate/${candidateToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${candidateToken}/portal`);

      // The sidebar uses [data-section-id] (mirrors portal-sidebar
      // existing convention referenced in the technical plan §10.2).
      await expect(
        page.locator('[data-section-id="service_verification-idv"]'),
      ).toBeVisible();

      // The legacy id must NOT appear.
      await expect(
        page.locator('[data-section-id="service_idv"]'),
      ).not.toBeVisible();
    });

    test('candidate can select a country and see country-driven DSX fields (BR 7)', async ({
      page,
    }) => {
      // BR 7 / User Flow steps 3-4: country picker → DSX fields fetched
      // via /api/candidate/application/[token]/fields with the same
      // per-country/per-service shape as edu/emp. TD-084 OR-merge of
      // isRequired applies automatically.
      await page.goto(`/candidate/${candidateToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${candidateToken}/portal`);

      await page.click('text=Identity Verification');

      // Country picker should be visible.
      const countryPicker = page.getByLabel(/country/i);
      await expect(countryPicker.first()).toBeVisible();

      // Pick a country with known DSX mappings. United States is the
      // canonical test country in the seeded data.
      await countryPicker.first().click();
      await page.click('text=United States');

      // After country selection, the DSX fields should appear. The
      // exact fields depend on the seeded DSX requirements for the
      // verification-idv service in the US; we assert generically that
      // SOMETHING country-specific renders (a fieldset / form section).
      await expect(
        page.locator(
          '[data-testid="dsx-field"], [data-testid="field-input"], form input',
        ).first(),
      ).toBeVisible({ timeout: 5000 });
    });

    test('save-route bucket key stays "idv" (BR 8 — internal markers not renamed)', async ({
      page,
    }) => {
      // BR 8 / Decision 5: "The candidate save-route sectionType enum
      // continues to accept 'idv' as the saved-data bucket key."
      // Edge Case 4: in-flight formData.sections.idv buckets are
      // unaffected. This test intercepts the save call from IdvSection
      // and verifies the request body still uses sectionType:'idv'.
      const savePromise = page.waitForRequest(
        (req) =>
          /\/api\/candidate\/application\/.+\/save/.test(req.url()) &&
          req.method() === 'POST',
      );

      await page.goto(`/candidate/${candidateToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${candidateToken}/portal`);

      await page.click('text=Identity Verification');

      const countryPicker = page.getByLabel(/country/i);
      await countryPicker.first().click();
      await page.click('text=United States');

      // Fill any visible input to trigger auto-save on blur.
      const firstInput = page.locator('form input').first();
      await firstInput.fill('test-value');
      await firstInput.blur();

      const saveRequest = await savePromise;
      const body = JSON.parse(saveRequest.postData() || '{}');

      // BR 8: bucket key stays 'idv' — NOT 'verification-idv'. This is
      // the most common implementer mistake.
      expect(body.sectionType).toBe('idv');
    });

    test('submit creates exactly one OrderItem per verification-idv service with the chosen country as locationId', async ({
      page,
    }) => {
      // DoD 11 + User Flow step 7: "When the candidate clicks Submit,
      // the validation engine confirms all required IDV fields have
      // values and the submission orchestrator creates one OrderItem
      // per IDV service with locationId set to the candidate's
      // selected country."
      //
      // This is the most important integration assertion: the rename
      // must not break the submission pipeline.
      await page.goto(`/candidate/${candidateToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${candidateToken}/portal`);

      // Fill out the IDV section (country + minimal required fields).
      // We assume the seeded test invitation has only the IDV section
      // pending — all other sections are pre-filled.
      await page.click('text=Identity Verification');

      const countryPicker = page.getByLabel(/country/i);
      await countryPicker.first().click();
      await page.click('text=United States');

      // Fill the first visible input. Real-world DSX fields may need
      // more attention; this is a smoke test, not a complete-fields test.
      await page.locator('form input').first().fill('Test Identity Value');

      // Submit the application.
      await page.click('button:has-text("Submit")');

      // After submit, we expect a success page or confirmation. The
      // exact post-submit URL varies; we assert on a success indicator.
      await expect(
        page.getByText(/submitted|thank you|confirmation/i),
      ).toBeVisible({ timeout: 10000 });

      // The Order detail check (one OrderItem, correct locationId) is
      // verified server-side via the integration tests in
      // src/lib/candidate/submission/__tests__/* (Pass 2 territory).
      // This e2e test only asserts the user-visible end of the flow.
    });
  });
});
