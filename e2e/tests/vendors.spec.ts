// /GlobalRX_v2/e2e/tests/vendors.spec.ts

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { VendorsPage } from '../pages/VendorsPage';
import { UsersPage } from '../pages/UsersPage';

test.describe('Vendor Management', () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    // Login as internal admin user
    await loginPage.goto();
    await loginPage.login('admin@globalrx.com', 'adminpass123');
    await page.waitForURL('**/dashboard');
  });

  test.describe('View Toggle', () => {
    test('internal admin should see view toggle', async ({ page }) => {
      // Check that view toggle is visible
      const viewToggle = page.locator('[data-testid="view-toggle"]');
      await expect(viewToggle).toBeVisible();

      // Check both buttons are present
      await expect(page.getByRole('button', { name: /configuration view/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /order view/i })).toBeVisible();
    });

    test('should switch between configuration and order views', async ({ page }) => {
      // Start in config view
      const configButton = page.getByRole('button', { name: /configuration view/i });
      await configButton.click();

      // Verify config menu items are visible
      await expect(page.getByRole('link', { name: /vendor organizations/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /customer configurations/i })).toBeVisible();

      // Switch to order view
      const orderButton = page.getByRole('button', { name: /order view/i });
      await orderButton.click();

      // Verify order menu items are visible
      await expect(page.getByRole('link', { name: /place order/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /order history/i })).toBeVisible();
    });

    test('customer user should not see view toggle', async ({ page }) => {
      // Logout and login as customer user
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('customer@company.com', 'customerpass');
      await page.waitForURL('**/dashboard');

      // View toggle should not be present
      const viewToggle = page.locator('[data-testid="view-toggle"]');
      await expect(viewToggle).not.toBeVisible();

      // Should only see order-related menu items
      await expect(page.getByRole('link', { name: /place order/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /vendor organizations/i })).not.toBeVisible();
    });

    test('vendor user should not see view toggle', async ({ page }) => {
      // Logout and login as vendor user
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendor@service.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // View toggle should not be present
      const viewToggle = page.locator('[data-testid="view-toggle"]');
      await expect(viewToggle).not.toBeVisible();

      // Should only see order fulfillment items
      await expect(page.getByRole('link', { name: /assigned orders/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /vendor organizations/i })).not.toBeVisible();
    });
  });

  test.describe('Vendor CRUD Operations', () => {
    test('should create a new vendor organization', async ({ page }) => {
      const vendorsPage = new VendorsPage(page);

      // Navigate to vendors page
      await vendorsPage.goto();

      // Click add vendor button
      await vendorsPage.clickAddVendor();

      // Fill in vendor form
      await vendorsPage.fillVendorForm({
        name: 'Test Vendor Inc',
        code: 'TVI',
        contactEmail: 'contact@testvendor.com',
        contactPhone: '555-0100',
        address: '123 Test Street',
        notes: 'Test vendor for automated testing'
      });

      // Save vendor
      await vendorsPage.saveVendor();

      // Verify success message
      await expect(page.getByText(/vendor created successfully/i)).toBeVisible();

      // Verify vendor appears in list
      await expect(page.getByText('Test Vendor Inc')).toBeVisible();
      await expect(page.getByText('TVI')).toBeVisible();
    });

    test('should not allow duplicate vendor codes', async ({ page }) => {
      const vendorsPage = new VendorsPage(page);

      await vendorsPage.goto();
      await vendorsPage.clickAddVendor();

      // Try to create vendor with existing code
      await vendorsPage.fillVendorForm({
        name: 'Another Vendor',
        code: 'TVI', // Same code as previous test
        contactEmail: 'another@vendor.com',
        contactPhone: '555-0200'
      });

      await vendorsPage.saveVendor();

      // Should show error
      await expect(page.getByText(/vendor code already exists/i)).toBeVisible();
    });

    test('should edit existing vendor', async ({ page }) => {
      const vendorsPage = new VendorsPage(page);

      await vendorsPage.goto();

      // Find and edit first vendor
      const firstVendorRow = page.locator('tr').filter({ hasText: 'Test Vendor Inc' });
      await firstVendorRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Update vendor name
      const nameField = page.getByLabel(/vendor name/i);
      await nameField.clear();
      await nameField.fill('Updated Vendor Inc');

      // Update contact email
      const emailField = page.getByLabel(/contact email/i);
      await emailField.clear();
      await emailField.fill('updated@vendor.com');

      // Save changes
      await page.getByRole('button', { name: /save/i }).click();

      // Verify success
      await expect(page.getByText(/vendor updated successfully/i)).toBeVisible();
      await expect(page.getByText('Updated Vendor Inc')).toBeVisible();
    });

    test('should set vendor as primary', async ({ page }) => {
      const vendorsPage = new VendorsPage(page);

      await vendorsPage.goto();

      // Edit vendor to set as primary
      const vendorRow = page.locator('tr').filter({ hasText: 'Updated Vendor Inc' });
      await vendorRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Check primary checkbox
      await page.getByLabel(/primary vendor/i).check();

      // Confirm warning about only one primary
      await expect(page.getByText(/only one vendor can be marked as primary/i)).toBeVisible();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Verify primary badge appears
      await expect(vendorRow.getByText(/primary/i)).toBeVisible();
    });

    test('should deactivate vendor', async ({ page }) => {
      const vendorsPage = new VendorsPage(page);

      await vendorsPage.goto();

      // Find vendor and deactivate
      const vendorRow = page.locator('tr').filter({ hasText: 'Updated Vendor Inc' });
      await vendorRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /deactivate/i }).click();

      // Confirm deactivation
      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify status changed
      await expect(vendorRow.getByText(/inactive/i)).toBeVisible();
    });

    test('should not delete vendor with assigned orders', async ({ page }) => {
      // First, create an order and assign to vendor
      // (This assumes order functionality exists)

      const vendorsPage = new VendorsPage(page);
      await vendorsPage.goto();

      // Try to delete vendor
      const vendorRow = page.locator('tr').filter({ hasText: 'Updated Vendor Inc' });
      await vendorRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /delete/i }).click();

      // Should show error
      await expect(page.getByText(/cannot delete vendor with assigned orders/i)).toBeVisible();
    });
  });

  test.describe('User Type Management', () => {
    test('should create vendor user and assign to vendor', async ({ page }) => {
      const usersPage = new UsersPage(page);

      // Navigate to users page
      await usersPage.goto();

      // Click add user
      await usersPage.clickAddUser();

      // Select vendor user type
      await page.getByLabel(/user type/i).selectOption('vendor');

      // Vendor dropdown should appear
      await expect(page.getByLabel(/vendor organization/i)).toBeVisible();

      // Fill user details
      await page.getByLabel(/email/i).fill('vendoruser@testvendor.com');
      await page.getByLabel(/name/i).fill('Vendor User');
      await page.getByLabel(/vendor organization/i).selectOption('Updated Vendor Inc');

      // Save user
      await page.getByRole('button', { name: /save/i }).click();

      // Verify user created
      await expect(page.getByText(/user created successfully/i)).toBeVisible();
      await expect(page.getByText('vendoruser@testvendor.com')).toBeVisible();
      await expect(page.getByText('Vendor')).toBeVisible();
    });

    test('vendor user cannot be reassigned to different vendor', async ({ page }) => {
      const usersPage = new UsersPage(page);

      await usersPage.goto();

      // Find vendor user and try to edit
      const userRow = page.locator('tr').filter({ hasText: 'vendoruser@testvendor.com' });
      await userRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Vendor dropdown should be disabled
      const vendorDropdown = page.getByLabel(/vendor organization/i);
      await expect(vendorDropdown).toBeDisabled();

      // Should show message
      await expect(page.getByText(/vendor users cannot be reassigned/i)).toBeVisible();
    });

    test('should create internal user with config permissions', async ({ page }) => {
      const usersPage = new UsersPage(page);

      await usersPage.goto();
      await usersPage.clickAddUser();

      // Select internal user type
      await page.getByLabel(/user type/i).selectOption('internal');

      // Permission checkboxes should appear
      await expect(page.getByLabel(/user admin/i)).toBeVisible();
      await expect(page.getByLabel(/global config/i)).toBeVisible();
      await expect(page.getByLabel(/customer config/i)).toBeVisible();
      await expect(page.getByLabel(/candidate workflow/i)).toBeVisible();

      // Fill user details
      await page.getByLabel(/email/i).fill('internaluser@globalrx.com');
      await page.getByLabel(/name/i).fill('Internal User');

      // Select permissions
      await page.getByLabel(/global config/i).check();
      await page.getByLabel(/customer config/i).check();
      await page.getByLabel(/candidate workflow/i).check();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Verify created
      await expect(page.getByText(/user created successfully/i)).toBeVisible();
      await expect(page.getByText('Internal')).toBeVisible();
    });

    test('should create customer user', async ({ page }) => {
      const usersPage = new UsersPage(page);

      await usersPage.goto();
      await usersPage.clickAddUser();

      // Select customer user type
      await page.getByLabel(/user type/i).selectOption('customer');

      // Customer dropdown should appear
      await expect(page.getByLabel(/customer/i)).toBeVisible();

      // Fill details
      await page.getByLabel(/email/i).fill('customeruser@company.com');
      await page.getByLabel(/name/i).fill('Customer User');
      await page.getByLabel(/customer/i).selectOption('Test Company');

      // Customer users only get candidate_workflow permission
      await expect(page.getByLabel(/user admin/i)).not.toBeVisible();
      await expect(page.getByLabel(/global config/i)).not.toBeVisible();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Verify
      await expect(page.getByText(/user created successfully/i)).toBeVisible();
      await expect(page.getByText('Customer')).toBeVisible();
    });
  });

  test.describe('Order Assignment', () => {
    test('new order should auto-assign to primary vendor', async ({ page }) => {
      // Switch to order view
      await page.getByRole('button', { name: /order view/i }).click();

      // Navigate to place order
      await page.getByRole('link', { name: /place order/i }).click();

      // Fill order form (minimal required fields)
      await page.getByLabel(/candidate name/i).fill('John Doe');
      await page.getByLabel(/candidate email/i).fill('john@example.com');

      // Submit order
      await page.getByRole('button', { name: /submit order/i }).click();

      // Check order details
      await page.getByRole('link', { name: /order history/i }).click();

      // Find the new order
      const orderRow = page.locator('tr').filter({ hasText: 'John Doe' }).first();

      // Should show primary vendor assignment
      await expect(orderRow.getByText('Updated Vendor Inc')).toBeVisible();
      await expect(orderRow.getByText(/auto-assigned/i)).toBeVisible();
    });

    test('should manually reassign order to different vendor', async ({ page }) => {
      // Navigate to order history
      await page.getByRole('button', { name: /order view/i }).click();
      await page.getByRole('link', { name: /order history/i }).click();

      // Find order and open actions
      const orderRow = page.locator('tr').filter({ hasText: 'John Doe' }).first();
      await orderRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /reassign vendor/i }).click();

      // Select different vendor
      await page.getByLabel(/select vendor/i).selectOption('Another Vendor Co');
      await page.getByLabel(/assignment notes/i).fill('Customer requested specific vendor');

      // Confirm reassignment
      await page.getByRole('button', { name: /reassign/i }).click();

      // Verify assignment changed
      await expect(page.getByText(/order reassigned successfully/i)).toBeVisible();
      await expect(orderRow.getByText('Another Vendor Co')).toBeVisible();
    });

    test('should assign to internal team when no primary vendor', async ({ page }) => {
      // First, unset primary vendor
      await page.getByRole('button', { name: /configuration view/i }).click();
      await page.getByRole('link', { name: /vendor organizations/i }).click();

      // Edit primary vendor to unset
      const vendorRow = page.locator('tr').filter({ hasText: /primary/i });
      await vendorRow.getByRole('button', { name: /actions/i }).click();
      await page.getByRole('menuitem', { name: /edit/i }).click();

      await page.getByLabel(/primary vendor/i).uncheck();
      await page.getByRole('button', { name: /save/i }).click();

      // Now create a new order
      await page.getByRole('button', { name: /order view/i }).click();
      await page.getByRole('link', { name: /place order/i }).click();

      await page.getByLabel(/candidate name/i).fill('Jane Smith');
      await page.getByLabel(/candidate email/i).fill('jane@example.com');
      await page.getByRole('button', { name: /submit order/i }).click();

      // Check assignment
      await page.getByRole('link', { name: /order history/i }).click();
      const orderRow = page.locator('tr').filter({ hasText: 'Jane Smith' }).first();

      // Should show internal assignment
      await expect(orderRow.getByText(/internal team/i)).toBeVisible();
      await expect(orderRow.getByText(/no primary vendor/i)).toBeVisible();
    });
  });

  test.describe('Vendor Isolation', () => {
    test('vendor user should only see their assigned orders', async ({ page }) => {
      // Logout and login as vendor user
      await page.getByRole('button', { name: /logout/i }).click();

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('vendoruser@testvendor.com', 'vendorpass');
      await page.waitForURL('**/dashboard');

      // Navigate to assigned orders
      await page.getByRole('link', { name: /assigned orders/i }).click();

      // Should only see orders assigned to their vendor
      const orders = page.locator('tbody tr');
      const count = await orders.count();

      for (let i = 0; i < count; i++) {
        const row = orders.nth(i);
        await expect(row.getByText('Updated Vendor Inc')).toBeVisible();
      }

      // Should not see orders assigned to other vendors or internal
      await expect(page.getByText('Another Vendor Co')).not.toBeVisible();
      await expect(page.getByText(/internal team/i)).not.toBeVisible();
    });

    test('vendor user cannot access vendor management', async ({ page }) => {
      // Try to navigate directly to vendor management URL
      await page.goto('/vendors');

      // Should be redirected or show forbidden
      await expect(page).toHaveURL(/\/(dashboard|forbidden|login)/);
      await expect(page.getByText(/not authorized|forbidden/i)).toBeVisible();
    });

    test('vendor user cannot access other vendor details via API', async ({ page }) => {
      // This would test API-level security
      // Try to fetch another vendor's details
      const response = await page.request.get('/api/vendors/other-vendor-id');

      expect(response.status()).toBe(403);

      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });
  });
});