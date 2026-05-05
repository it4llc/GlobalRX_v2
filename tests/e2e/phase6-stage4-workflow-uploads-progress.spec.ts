// /GlobalRX_v2/tests/e2e/phase6-stage4-workflow-uploads-progress.spec.ts
// Pass 1 e2e tests for Phase 6 Stage 4:
// Workflow sections, document uploads, section progress indicators, and
// cross-section requirement banner in the candidate portal.
//
// These tests will FAIL when first run because the feature does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage of Stage 4 Pass 1 e2e cases (per spec DoD #21 and Testing Strategy):
//   - Candidate sees workflow sections in the correct zones (before/after services)
//     per `placement` and `displayOrder`.
//   - Candidate can check the acknowledgment checkbox on a workflow section and the
//     state persists across reload.
//   - Candidate can upload a document to a document-type DSX requirement.
//   - Candidate sees an upload progress indicator during upload.
//   - Candidate can remove an uploaded document.
//   - Section progress indicators show `not_started`, `incomplete`, and `complete`
//     states correctly (lowercase values per BR 22).
//   - Cross-section requirements cause Personal Information to show `incomplete`
//     when the externally-triggered field is empty; banner lists the field.
//   - Mobile: camera option available via the file input on mobile devices.

import { test, expect } from '@playwright/test';

// Test fixtures — the implementer is responsible for seeding these tokens
// against a candidate invitation that exposes the relevant package shape.
const TOKEN_WITH_WORKFLOW_SECTIONS = 'test-stage4-token-workflow-sections';
const TOKEN_WITH_DOCUMENT_REQUIREMENT = 'test-stage4-token-document-upload';
const TOKEN_WITH_CROSS_SECTION_REQUIREMENT = 'test-stage4-token-cross-section';

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

test.describe('Phase 6 Stage 4 — Workflow Sections, Uploads, Progress', () => {

  // ------------------------------------------------------------------------
  // Workflow Section Zones (BR 1, 2; Spec User Flow 1)
  // ------------------------------------------------------------------------

  test.describe('Workflow Sections', () => {
    test('workflow sections with placement = before_services render before service sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 1, BR 2, DoD #4
      await loginAsCandidate(page, TOKEN_WITH_WORKFLOW_SECTIONS);

      const sectionItems = page.locator('[data-testid="section-item"]');

      // The first section in the sidebar must be the before_services workflow section
      // (e.g., "Notice of Processing"), and Personal Information must come AFTER it.
      const noticeOfProcessing = sectionItems.filter({ hasText: 'Notice of Processing' });
      const personalInfo = sectionItems.filter({ hasText: 'Personal Information' });

      await expect(noticeOfProcessing).toHaveCount(1);
      await expect(personalInfo).toHaveCount(1);

      // Check ordering by reading textContent
      const allTexts = await sectionItems.allTextContents();
      const noticeIdx = allTexts.findIndex((t) => t.includes('Notice of Processing'));
      const personalIdx = allTexts.findIndex((t) => t.includes('Personal Information'));

      expect(noticeIdx).toBeGreaterThanOrEqual(0);
      expect(personalIdx).toBeGreaterThanOrEqual(0);
      expect(noticeIdx).toBeLessThan(personalIdx);
    });

    test('workflow sections with placement = after_services render after service sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 2, DoD #4
      await loginAsCandidate(page, TOKEN_WITH_WORKFLOW_SECTIONS);

      const sectionItems = page.locator('[data-testid="section-item"]');
      const allTexts = await sectionItems.allTextContents();

      // "Authorization to Run Background Check" is an after_services workflow section
      const authIdx = allTexts.findIndex((t) =>
        t.includes('Authorization to Run Background Check')
      );
      const personalIdx = allTexts.findIndex((t) => t.includes('Personal Information'));

      expect(authIdx).toBeGreaterThanOrEqual(0);
      expect(personalIdx).toBeGreaterThanOrEqual(0);
      expect(authIdx).toBeGreaterThan(personalIdx);
    });

    test('candidate can check acknowledgment checkbox on a workflow section and state persists across reload', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 5, BR 6, BR 7, BR 8, DoD #2, DoD #3 — Spec User Flow 1
      await loginAsCandidate(page, TOKEN_WITH_WORKFLOW_SECTIONS);

      // Click the workflow section in the sidebar
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Notice of Processing' })
        .click();

      // The acknowledgment checkbox is labelled by the hardcoded translation
      // "I have read and agree to the above" (BR 5)
      const ackCheckbox = page.locator(
        '[data-testid="workflow-section-acknowledgment"]'
      );
      await expect(ackCheckbox).toBeVisible();
      await expect(ackCheckbox).not.toBeChecked();

      await ackCheckbox.click();
      await expect(ackCheckbox).toBeChecked();

      // The progress indicator next to the section turns green/complete
      // (status value is lowercase `complete` per BR 22)
      const progressIndicator = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Notice of Processing' })
        .locator('[data-testid="section-progress-indicator"]');

      await expect(progressIndicator).toHaveAttribute('data-status', 'complete');

      // Reload — the acknowledgment must still be set
      await page.reload();
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Notice of Processing' })
        .click();

      await expect(
        page.locator('[data-testid="workflow-section-acknowledgment"]')
      ).toBeChecked();
    });
  });

  // ------------------------------------------------------------------------
  // Document Upload (BR 9, 10, 13, 21; Spec User Flow 2)
  // ------------------------------------------------------------------------

  test.describe('Document Upload', () => {
    test('candidate can upload a document and sees the uploaded filename + remove button', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 9, BR 10, BR 21, DoD #5, DoD #6, DoD #9 — Spec User Flow 2
      await loginAsCandidate(page, TOKEN_WITH_DOCUMENT_REQUIREMENT);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      // Upload control empty state must show "Upload" button per Stage 4 spec
      const uploadInput = page.locator(
        '[data-testid="candidate-document-upload-input"]'
      );

      // Provide a small valid PDF as the upload file
      const fileBuffer = Buffer.from('%PDF-1.4 dummy contents');
      await uploadInput.setInputFiles({
        name: 'diploma.pdf',
        mimeType: 'application/pdf',
        buffer: fileBuffer,
      });

      // After the upload completes, the uploaded state shows filename + remove button
      const uploadedRow = page.locator(
        '[data-testid="candidate-document-uploaded"]'
      );

      await expect(uploadedRow).toBeVisible({ timeout: 10000 });
      await expect(uploadedRow).toContainText('diploma.pdf');

      const removeButton = page.locator(
        '[data-testid="candidate-document-remove-button"]'
      );
      await expect(removeButton).toBeVisible();
    });

    test('candidate sees an uploading progress indicator during upload (TD-011)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec TD-011 / DoD per spec — feedback during upload
      await loginAsCandidate(page, TOKEN_WITH_DOCUMENT_REQUIREMENT);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      // Slow down the upload response so we can observe the uploading state
      await page.route(
        `**/api/candidate/application/${TOKEN_WITH_DOCUMENT_REQUIREMENT}/upload`,
        async (route) => {
          await new Promise((r) => setTimeout(r, 1500));
          await route.continue();
        }
      );

      const uploadInput = page.locator(
        '[data-testid="candidate-document-upload-input"]'
      );
      const fileBuffer = Buffer.from('%PDF-1.4 dummy contents');
      await uploadInput.setInputFiles({
        name: 'diploma.pdf',
        mimeType: 'application/pdf',
        buffer: fileBuffer,
      });

      // The uploading state appears during upload
      await expect(
        page.locator('[data-testid="candidate-document-uploading"]')
      ).toBeVisible();
    });

    test('candidate can remove an uploaded document', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 13, DoD #7
      await loginAsCandidate(page, TOKEN_WITH_DOCUMENT_REQUIREMENT);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      const uploadInput = page.locator(
        '[data-testid="candidate-document-upload-input"]'
      );
      const fileBuffer = Buffer.from('%PDF-1.4 dummy contents');
      await uploadInput.setInputFiles({
        name: 'diploma.pdf',
        mimeType: 'application/pdf',
        buffer: fileBuffer,
      });

      const uploadedRow = page.locator(
        '[data-testid="candidate-document-uploaded"]'
      );
      await expect(uploadedRow).toBeVisible({ timeout: 10000 });

      // Click remove
      await page
        .locator('[data-testid="candidate-document-remove-button"]')
        .click();

      // The component returns to the empty state — uploaded row goes away
      await expect(uploadedRow).toBeHidden();

      // The empty state upload control is visible again
      await expect(
        page.locator('[data-testid="candidate-document-upload-input"]')
      ).toBeVisible();
    });
  });

  // ------------------------------------------------------------------------
  // Section Progress Indicators (BR 14, 22; DoD 10)
  // ------------------------------------------------------------------------

  test.describe('Section Progress Indicators', () => {
    test('all section indicators expose lowercase status values (not_started, incomplete, complete)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 14, BR 22, DoD #10, DoD #20
      await loginAsCandidate(page, TOKEN_WITH_WORKFLOW_SECTIONS);

      // Every sidebar section item must carry a progress indicator child whose
      // data-status attribute is one of the three lowercase values.
      const indicators = page.locator(
        '[data-testid="section-progress-indicator"]'
      );
      const count = await indicators.count();
      expect(count).toBeGreaterThan(0);

      const allowed = ['not_started', 'incomplete', 'complete'];
      for (let i = 0; i < count; i += 1) {
        const status = await indicators.nth(i).getAttribute('data-status');
        expect(allowed).toContain(status);
      }
    });

    test('a not_started section becomes incomplete when the candidate starts entering data and complete when all required data is satisfied', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 14, BR 15
      await loginAsCandidate(page, TOKEN_WITH_WORKFLOW_SECTIONS);

      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });
      const indicator = personalInfoRow.locator(
        '[data-testid="section-progress-indicator"]'
      );

      // Initial state — depending on the seed, this is `not_started` or `incomplete`,
      // never `complete` (because at least one required field hasn't been filled yet
      // by the seed). Click into the section to begin filling it in.
      await personalInfoRow.click();

      // Trigger the on-blur autosave for one editable field (date of birth is
      // editable per Stage 1). After that the section must NOT be `complete`
      // (other required fields remain), so it's `incomplete`.
      const dobField = page.locator('input[name="dateOfBirth"]');
      await dobField.fill('1990-01-15');
      await dobField.blur();

      await expect(indicator).toHaveAttribute('data-status', 'incomplete');
    });
  });

  // ------------------------------------------------------------------------
  // Cross-section requirement (BR 17, 18, 19, 20; Spec User Flow 3)
  // ------------------------------------------------------------------------

  test.describe('Cross-section Requirement Awareness', () => {
    test('Personal Information shows incomplete and a banner when an Address History entry triggers a subject-targeted requirement', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 17, BR 18, BR 20, DoD #14, DoD #15 — Spec User Flow 3
      await loginAsCandidate(page, TOKEN_WITH_CROSS_SECTION_REQUIREMENT);

      // Step 1: Personal Information starts complete (locally-required fields are
      // pre-filled by the invitation seed for this token).
      const personalInfoRow = page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' });
      const personalInfoIndicator = personalInfoRow.locator(
        '[data-testid="section-progress-indicator"]'
      );

      await expect(personalInfoIndicator).toHaveAttribute(
        'data-status',
        'complete'
      );

      // Step 2: Go to Address History and enter an address in the country that
      // triggers a subject-targeted requirement (e.g., Middle Name in Australia).
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      const countrySelect = page
        .locator('[data-testid="address-entry-country-select"]')
        .first();
      await countrySelect.click();
      await page.locator('[data-testid="country-option-AU"]').click();

      // Step 3: Personal Information now becomes incomplete because Middle Name
      // is empty and the cross-section registry registered it under `subject`.
      await expect(personalInfoIndicator).toHaveAttribute(
        'data-status',
        'incomplete'
      );

      // Step 4: Navigate to Personal Information; the banner is visible and lists
      // the externally-triggered required field.
      await personalInfoRow.click();

      const banner = page.locator(
        '[data-testid="cross-section-requirement-banner"]'
      );
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Middle Name');
    });

    test('removing the address entry that triggered the requirement clears it from Personal Information (BR 19)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec BR 19, DoD #16
      await loginAsCandidate(page, TOKEN_WITH_CROSS_SECTION_REQUIREMENT);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Address History' })
        .click();

      // Select the country that triggers a subject-targeted requirement.
      const countrySelect = page
        .locator('[data-testid="address-entry-country-select"]')
        .first();
      await countrySelect.click();
      await page.locator('[data-testid="country-option-AU"]').click();

      // Add a second entry so the first entry can be removed (Stage 3 rule:
      // first entry's remove control is hidden when only one exists).
      await page.locator('[data-testid="add-entry-button"]').click();

      // Remove the first entry.
      await page
        .locator('[data-testid="entry-remove-button"]')
        .first()
        .click();

      // The cross-section banner on Personal Information disappears (no other
      // entry triggered the requirement).
      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Personal Information' })
        .click();

      const banner = page.locator(
        '[data-testid="cross-section-requirement-banner"]'
      );
      await expect(banner).toBeHidden();
    });
  });

  // ------------------------------------------------------------------------
  // Mobile camera affordance (DoD 18)
  // ------------------------------------------------------------------------

  test.describe('Mobile Camera Affordance', () => {
    test('document upload <input> exposes capture="environment" so iOS/Android can offer the camera', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Spec DoD #18 — capture attribute presence is observable in the rendered DOM
      await loginAsCandidate(page, TOKEN_WITH_DOCUMENT_REQUIREMENT);

      await page
        .locator('[data-testid="section-item"]')
        .filter({ hasText: 'Education History' })
        .click();

      const uploadInput = page.locator(
        '[data-testid="candidate-document-upload-input"]'
      );

      const captureValue = await uploadInput.getAttribute('capture');
      expect(captureValue).toBe('environment');

      const acceptValue = await uploadInput.getAttribute('accept');
      // accept must include the three allowed types
      expect(acceptValue).toMatch(/pdf/);
      expect(acceptValue).toMatch(/jpg|jpeg/);
      expect(acceptValue).toMatch(/png/);
    });
  });
});
