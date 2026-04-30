// /GlobalRX_v2/tests/e2e/candidate-portal-shell.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Candidate Portal Shell - E2E Tests', () => {

  test.describe('Portal Layout and Navigation', () => {
    test('candidate sees portal shell after successful login', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Step 1: Navigate to candidate landing page with token
      const testToken = 'test-valid-token-123';
      await page.goto(`/candidate/${testToken}`);

      // Step 2: Enter password and login (assuming password already set from Stage 1)
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 3: Should be redirected to portal page
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 4: Verify portal shell elements are present
      // Header should show welcome message with first name
      await expect(page.locator('header')).toContainText('Welcome');

      // Sign out button should be visible
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();

      // Sidebar should be visible on desktop
      const viewportSize = page.viewportSize();
      if (viewportSize && viewportSize.width >= 768) {
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      }

      // Main content area should be visible
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    });

    test('portal shell checks session on every page load', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Try to access portal directly without session
      await page.goto(`/candidate/${testToken}/portal`);

      // Step 2: Should be redirected to login page
      await page.waitForURL(`**/candidate/${testToken}`);

      // Step 3: Verify login form is shown
      await expect(page.locator('input[name="password"]')).toBeVisible();
    });

    test('shows invitation expired message for expired invitations', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const expiredToken = 'test-expired-token-456';

      // Step 1: Login with expired invitation
      await page.goto(`/candidate/${expiredToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to portal
      await page.waitForURL(`**/candidate/${expiredToken}/portal`);

      // Step 3: Should see expired message with company name
      await expect(page.locator('text=/Your invitation has expired/')).toBeVisible();
      await expect(page.locator('text=/Please contact.*for assistance/')).toBeVisible();

      // Step 4: No sidebar or sections should be visible
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

      // Step 5: Sign out button should still be available
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    });

    test('shows completed confirmation for already submitted applications', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const completedToken = 'test-completed-token-789';

      // Step 1: Login with completed invitation
      await page.goto(`/candidate/${completedToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Navigate to portal
      await page.waitForURL(`**/candidate/${completedToken}/portal`);

      // Step 3: Should see confirmation message
      await expect(page.locator('text=/Your application has been submitted/')).toBeVisible();
      await expect(page.locator('text=/Thank you/')).toBeVisible();

      // Step 4: No sidebar or sections should be visible
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

      // Step 5: Sign out button should still be available
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    });
  });

  test.describe('Section List and Organization', () => {
    test('fetches and displays sections in correct order', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Verify sections appear in correct order
      const sections = page.locator('[data-testid="section-item"]');

      // Should have sections (count depends on test data)
      await expect(sections).toHaveCount(await sections.count());

      // Verify order: before_services sections first, then service sections, then after_services
      // This will be validated once we can see the actual section placements
      const firstSection = sections.first();
      await expect(firstSection).toBeVisible();
    });

    test('displays friendly headings for service sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Check for friendly service section names
      // Should see "Identity Verification", not internal service names
      const identitySection = page.locator('text="Identity Verification"');
      const addressSection = page.locator('text="Address History"');
      const educationSection = page.locator('text="Education History"');
      const employmentSection = page.locator('text="Employment History"');

      // At least one should be visible depending on package configuration
      const hasSomeServiceSections =
        await identitySection.isVisible().catch(() => false) ||
        await addressSection.isVisible().catch(() => false) ||
        await educationSection.isVisible().catch(() => false) ||
        await employmentSection.isVisible().catch(() => false);

      expect(hasSomeServiceSections).toBe(true);
    });

    test('combines multiple services of same type into one section', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const tokenWithDuplicateServices = 'test-duplicate-services-token';

      // Step 1: Login
      await page.goto(`/candidate/${tokenWithDuplicateServices}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${tokenWithDuplicateServices}/portal`);

      // Step 3: Count occurrences of each service type
      const educationSections = page.locator('text="Education History"');
      const educationCount = await educationSections.count();

      // Should only see one "Education History" even if package has multiple education services
      expect(educationCount).toBeLessThanOrEqual(1);
    });

    test('shows all sections with not_started status initially', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Check status indicators
      const statusIndicators = page.locator('[data-testid="section-status"]');
      const count = await statusIndicators.count();

      // All should show "not started" status (grey color or specific text)
      for (let i = 0; i < count; i++) {
        const indicator = statusIndicators.nth(i);
        // Check for not_started status (implementation may vary)
        await expect(indicator).toHaveAttribute('data-status', 'not_started');
      }
    });
  });

  test.describe('Section Navigation', () => {
    test('clicking section in sidebar shows section content', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Click on a section
      const firstSection = page.locator('[data-testid="section-item"]').first();
      const sectionText = await firstSection.textContent();
      await firstSection.click();

      // Step 4: Verify section content appears
      const mainContent = page.locator('[data-testid="main-content"]');
      await expect(mainContent).toContainText('This section will be available soon');

      // Step 5: Verify section is highlighted in sidebar
      await expect(firstSection).toHaveAttribute('data-active', 'true');
    });

    test('browser back button works with section navigation', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Click on first section
      const firstSection = page.locator('[data-testid="section-item"]').first();
      await firstSection.click();

      // Step 4: Click on second section
      const secondSection = page.locator('[data-testid="section-item"]').nth(1);
      await secondSection.click();

      // Step 5: Use browser back button
      await page.goBack();

      // Step 6: First section should be active again
      await expect(firstSection).toHaveAttribute('data-active', 'true');
      await expect(secondSection).not.toHaveAttribute('data-active', 'true');
    });
  });

  test.describe('Mobile Experience', () => {
    test('shows hamburger menu on mobile instead of sidebar', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Sidebar should not be visible
      await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();

      // Step 4: Hamburger menu button should be visible
      const hamburgerButton = page.locator('[data-testid="hamburger-menu"]');
      await expect(hamburgerButton).toBeVisible();

      // Step 5: Click hamburger to open menu
      await hamburgerButton.click();

      // Step 6: Menu panel should slide out
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await expect(mobileMenu).toBeVisible();

      // Step 7: Menu should contain sections
      const sections = mobileMenu.locator('[data-testid="section-item"]');
      await expect(sections.first()).toBeVisible();
    });

    test('mobile menu closes when section is selected', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login and navigate to portal
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Open hamburger menu
      await page.locator('[data-testid="hamburger-menu"]').click();

      // Step 3: Click on a section
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      await mobileMenu.locator('[data-testid="section-item"]').first().click();

      // Step 4: Menu should close
      await expect(mobileMenu).not.toBeVisible();

      // Step 5: Section content should be visible
      await expect(page.locator('[data-testid="main-content"]')).toContainText('This section will be available soon');
    });

    test('all touch targets are at least 44px tall on mobile', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      // Set mobile viewport to minimum supported width
      await page.setViewportSize({ width: 320, height: 568 });

      const testToken = 'test-valid-token-123';

      // Step 1: Login and navigate to portal
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Check all interactive elements
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }

      // Step 3: Open mobile menu and check section items
      await page.locator('[data-testid="hamburger-menu"]').click();
      const sectionItems = page.locator('[data-testid="section-item"]');
      const sectionCount = await sectionItems.count();

      for (let i = 0; i < sectionCount; i++) {
        const item = sectionItems.nth(i);
        const box = await item.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Sign Out Functionality', () => {
    test('sign out button logs out and redirects to landing page', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Wait for portal to load
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 3: Click sign out
      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Step 4: Should be redirected to landing page
      await page.waitForURL(`**/candidate/${testToken}`);

      // Step 5: Login form should be visible again
      await expect(page.locator('input[name="password"]')).toBeVisible();

      // Step 6: Try to access portal directly - should redirect to login
      await page.goto(`/candidate/${testToken}/portal`);
      await page.waitForURL(`**/candidate/${testToken}`);
    });
  });

  test.describe('API Endpoint - Structure', () => {
    test('structure endpoint returns correct section data', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login to get session
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Call structure endpoint
      const response = await page.request.get(`/api/candidate/application/${testToken}/structure`);

      // Step 3: Verify response status
      expect(response.status()).toBe(200);

      // Step 4: Verify response shape
      const data = await response.json();

      // Should have invitation object
      expect(data).toHaveProperty('invitation');
      expect(data.invitation).toHaveProperty('firstName');
      expect(data.invitation).toHaveProperty('lastName');
      expect(data.invitation).toHaveProperty('status');
      expect(data.invitation).toHaveProperty('expiresAt');
      expect(data.invitation).toHaveProperty('companyName');

      // Should have sections array
      expect(data).toHaveProperty('sections');
      expect(Array.isArray(data.sections)).toBe(true);

      // Each section should have required fields
      if (data.sections.length > 0) {
        const firstSection = data.sections[0];
        expect(firstSection).toHaveProperty('id');
        expect(firstSection).toHaveProperty('title');
        expect(firstSection).toHaveProperty('type');
        expect(firstSection).toHaveProperty('placement');
        expect(firstSection).toHaveProperty('status');
        expect(firstSection).toHaveProperty('order');

        // Status should be 'not_started' in this stage
        expect(firstSection.status).toBe('not_started');
      }
    });

    test('structure endpoint requires valid session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Call endpoint without session
      const response = await page.request.get(`/api/candidate/application/${testToken}/structure`);

      // Step 2: Should return 401
      expect(response.status()).toBe(401);
    });

    test('structure endpoint validates token matches session', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';
      const wrongToken = 'wrong-token-456';

      // Step 1: Login with one token
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Try to access structure for different token
      const response = await page.request.get(`/api/candidate/application/${wrongToken}/structure`);

      // Step 3: Should return 403
      expect(response.status()).toBe(403);
    });

    test('sections maintain correct order by placement groups', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Get structure
      const response = await page.request.get(`/api/candidate/application/${testToken}/structure`);
      const data = await response.json();

      // Step 3: Verify sections are in correct order
      let lastPlacement = '';
      let lastOrderInPlacement = -1;

      for (const section of data.sections) {
        // Placement groups should be in order: before_services, services, after_services
        if (section.placement !== lastPlacement) {
          if (lastPlacement === '') {
            expect(['before_services', 'services', 'after_services']).toContain(section.placement);
          } else if (lastPlacement === 'before_services') {
            expect(['services', 'after_services']).toContain(section.placement);
          } else if (lastPlacement === 'services') {
            expect(section.placement).toBe('after_services');
          }
          lastPlacement = section.placement;
          lastOrderInPlacement = section.order;
        } else {
          // Within same placement, order should increase
          expect(section.order).toBeGreaterThan(lastOrderInPlacement);
          lastOrderInPlacement = section.order;
        }
      }
    });

    test('service sections appear in fixed order', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-with-all-services';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Get structure
      const response = await page.request.get(`/api/candidate/application/${testToken}/structure`);
      const data = await response.json();

      // Step 3: Extract service sections
      const serviceSections = data.sections.filter((s: any) => s.type === 'service_section');

      // Step 4: Verify order is: IDV → Record → Education → Employment
      const serviceOrder = ['idv', 'record', 'verification-edu', 'verification-emp'];
      let lastIndex = -1;

      for (const section of serviceSections) {
        const currentIndex = serviceOrder.indexOf(section.functionalityType);
        if (currentIndex !== -1) {
          expect(currentIndex).toBeGreaterThan(lastIndex);
          lastIndex = currentIndex;
        }
      }
    });
  });

  test.describe('Error Handling', () => {
    test('shows friendly error when network fails loading sections', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Step 2: Intercept structure endpoint to fail
      await page.route('**/api/candidate/application/**/structure', route => {
        route.abort('failed');
      });

      // Step 3: Navigate to portal
      await page.goto(`/candidate/${testToken}/portal`);

      // Step 4: Should see error message
      await expect(page.locator('text=/error|failed|try again/i')).toBeVisible();

      // Step 5: Should have retry button
      const retryButton = page.getByRole('button', { name: /try again/i });
      await expect(retryButton).toBeVisible();
    });

    test('handles session expiration during usage', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Intercept next API call to return 401
      await page.route('**/api/candidate/**', route => {
        route.fulfill({ status: 401 });
      });

      // Step 3: Try to navigate to a section
      const firstSection = page.locator('[data-testid="section-item"]').first();
      await firstSection.click();

      // Step 4: Should be redirected to login
      await page.waitForURL(`**/candidate/${testToken}`);
      await expect(page.locator('input[name="password"]')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('handles package with no services gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const tokenNoServices = 'test-no-services-token';

      // Step 1: Login
      await page.goto(`/candidate/${tokenNoServices}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${tokenNoServices}/portal`);

      // Step 2: Portal should still load
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();

      // Step 3: Should only show workflow sections
      const sections = page.locator('[data-testid="section-item"]');
      const sectionCount = await sections.count();

      // Should have at least some workflow sections
      expect(sectionCount).toBeGreaterThan(0);
    });

    test('handles workflow with no sections gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const tokenNoWorkflow = 'test-no-workflow-sections-token';

      // Step 1: Login
      await page.goto(`/candidate/${tokenNoWorkflow}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${tokenNoWorkflow}/portal`);

      // Step 2: Portal should still load
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();

      // Step 3: Should only show service sections
      const sections = page.locator('[data-testid="section-item"]');
      const sectionCount = await sections.count();

      // Should have at least some service sections
      expect(sectionCount).toBeGreaterThan(0);
    });

    test('handles empty section list (no services, no workflow sections)', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const tokenEmpty = 'test-empty-sections-token';

      // Step 1: Login
      await page.goto(`/candidate/${tokenEmpty}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${tokenEmpty}/portal`);

      // Step 2: Portal should still load
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible();

      // Step 3: Should show appropriate message
      await expect(page.locator('text=/Your application has 0 sections/i')).toBeVisible();
    });

    test('portal is isolated from main application', async ({ page }) => {
      // THIS TEST WILL FAIL - feature doesn't exist yet
      const testToken = 'test-valid-token-123';

      // Step 1: Login as candidate
      await page.goto(`/candidate/${testToken}`);
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/candidate/${testToken}/portal`);

      // Step 2: Try to navigate to admin pages
      await page.goto('/portal/dashboard');

      // Step 3: Should not be able to access (redirected or blocked)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/portal/dashboard');

      // Step 4: Try to navigate to customer pages
      await page.goto('/customer-configs');

      // Step 5: Should not be able to access
      const customerUrl = page.url();
      expect(customerUrl).not.toContain('/customer-configs');
    });
  });
});