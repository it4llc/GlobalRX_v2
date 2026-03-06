// /GlobalRX_v2/e2e/tests/service-fulfillment.spec.ts

import { test, expect } from '../fixtures/auth';

test.describe('Service-Level Vendor Assignment and Status Tracking', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Navigate to fulfillment page
    await page.goto('/fulfillment/orders');
    await page.waitForSelector('table, .order-list', { timeout: 10000 });
  });

  test('should display services for an order', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    // Navigate to order details
    const firstOrderRow = page.locator('tbody tr').first();
    const viewButton = firstOrderRow.locator('button:has-text("View"), a:has-text("View")');

    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      viewButton.click()
    ]);

    await newPage.waitForLoadState();

    // Verify services section exists
    const servicesSection = newPage.locator('section:has-text("Services"), div:has(h2:has-text("Services"))');
    await expect(servicesSection).toBeVisible();

    // Verify service table exists
    const serviceTable = newPage.locator('table[aria-label="Service fulfillment status"]');
    await expect(serviceTable).toBeVisible();

    // Verify table headers
    await expect(newPage.locator('th:has-text("Service")')).toBeVisible();
    await expect(newPage.locator('th:has-text("Location")')).toBeVisible();
    await expect(newPage.locator('th:has-text("Status")')).toBeVisible();
    await expect(newPage.locator('th:has-text("Assigned Vendor")')).toBeVisible();
  });

  test('admin can assign service to vendor', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    // Navigate to order with unassigned services
    await page.goto('/fulfillment/orders/test-order-with-services');

    // Find unassigned service
    const unassignedService = page.locator('tr:has-text("Not Assigned")').first();
    const assignButton = unassignedService.locator('button:has-text("Assign")');

    await assignButton.click();

    // Assignment dialog should open
    const assignDialog = page.locator('dialog:has-text("Assign Service to Vendor"), div[role="dialog"]:has-text("Assign Service to Vendor")');
    await expect(assignDialog).toBeVisible();

    // Select vendor
    const vendorSelect = assignDialog.locator('select[name="vendorId"], select#vendor-select');
    await vendorSelect.selectOption({ label: 'Background Vendor Inc' });

    // Confirm assignment
    const confirmButton = assignDialog.locator('button:has-text("Confirm Assignment")');
    await confirmButton.click();

    // Wait for dialog to close
    await expect(assignDialog).not.toBeVisible();

    // Verify vendor is now assigned
    await expect(unassignedService.locator('text="Background Vendor Inc"')).toBeVisible();
  });

  test('admin can bulk assign multiple services to vendor', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    // Select multiple services
    const checkboxes = page.locator('input[type="checkbox"][aria-label*="Select service"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Verify selection count
    await expect(page.locator('text="3 services selected"')).toBeVisible();

    // Click bulk assign button
    const bulkAssignButton = page.locator('button:has-text("Bulk Assign to Vendor")');
    await bulkAssignButton.click();

    // Bulk assignment dialog should open
    const bulkDialog = page.locator('dialog:has-text("Bulk Assign Services"), div[role="dialog"]:has-text("Bulk Assign Services")');
    await expect(bulkDialog).toBeVisible();
    await expect(bulkDialog.locator('text="3 services will be assigned"')).toBeVisible();

    // Select vendor
    const vendorSelect = bulkDialog.locator('select[name="vendorId"]');
    await vendorSelect.selectOption({ label: 'Verification Services LLC' });

    // Confirm bulk assignment
    const confirmButton = bulkDialog.locator('button:has-text("Confirm Assignment")');
    await confirmButton.click();

    // Wait for success message
    await expect(page.locator('text="3 services assigned to vendor"')).toBeVisible();
  });

  test('vendor can update status of assigned services', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    // Login as vendor user
    await page.goto('/api/auth/signout');
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'vendor@example.com');
    await page.fill('input[name="password"]', 'vendor-password');
    await page.click('button[type="submit"]');

    // Navigate to fulfillment page
    await page.goto('/fulfillment/services');

    // Vendor should only see assigned services
    const serviceRows = page.locator('tbody tr');
    await expect(serviceRows).toHaveCount(2); // Only services assigned to this vendor

    // Update status of first service
    const firstServiceRow = serviceRows.first();
    const statusDropdown = firstServiceRow.locator('select[name="status"], select[aria-label*="Status"]');

    await statusDropdown.selectOption('processing');

    // Wait for status to update
    await expect(firstServiceRow.locator('span:has-text("processing"), .badge:has-text("processing")')).toBeVisible();

    // Update to completed
    await statusDropdown.selectOption('completed');

    // Confirmation dialog for terminal status
    const confirmDialog = page.locator('dialog:has-text("Confirm Status Change")');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('button:has-text("Confirm")').click();

    // Status should be updated and dropdown disabled
    await expect(firstServiceRow.locator('span:has-text("completed")')).toBeVisible();
    await expect(statusDropdown).toBeDisabled();
  });

  test('vendor can add notes to assigned services', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    // Assume logged in as vendor
    await page.goto('/fulfillment/services');

    const firstServiceRow = page.locator('tbody tr').first();
    const actionsButton = firstServiceRow.locator('button:has-text("Actions")');
    await actionsButton.click();

    // Click edit notes option
    const editNotesOption = page.locator('button:has-text("Edit Notes"), a:has-text("Edit Notes")');
    await editNotesOption.click();

    // Notes dialog should open
    const notesDialog = page.locator('dialog:has-text("Edit Service Notes")');
    await expect(notesDialog).toBeVisible();

    // Vendor should only see vendor notes field
    const vendorNotesField = notesDialog.locator('textarea[name="vendorNotes"]');
    await expect(vendorNotesField).toBeVisible();

    // Internal notes should not be visible to vendor
    const internalNotesField = notesDialog.locator('textarea[name="internalNotes"]');
    await expect(internalNotesField).not.toBeVisible();

    // Add vendor notes
    await vendorNotesField.fill('Background check completed successfully. All records clear.');

    // Save notes
    const saveButton = notesDialog.locator('button:has-text("Save Notes")');
    await saveButton.click();

    // Dialog should close
    await expect(notesDialog).not.toBeVisible();

    // Success message
    await expect(page.locator('text="Notes updated successfully"')).toBeVisible();
  });

  test('admin can reassign service between vendors', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    // Find service with existing vendor
    const assignedService = page.locator('tr:has-text("Background Vendor Inc")').first();
    const reassignButton = assignedService.locator('button:has-text("Reassign")');

    await reassignButton.click();

    // Reassignment dialog should open
    const reassignDialog = page.locator('dialog:has-text("Reassign Service")');
    await expect(reassignDialog).toBeVisible();

    // Should show current vendor
    await expect(reassignDialog.locator('text="Currently assigned to: Background Vendor Inc"')).toBeVisible();

    // Select new vendor
    const vendorSelect = reassignDialog.locator('select[name="vendorId"]');
    await vendorSelect.selectOption({ label: 'Verification Services LLC' });

    // Add reassignment reason
    const reasonField = reassignDialog.locator('textarea[name="reason"]');
    await reasonField.fill('Vendor capacity issues - reassigning to available vendor');

    // Confirm reassignment
    const confirmButton = reassignDialog.locator('button:has-text("Confirm Reassignment")');
    await confirmButton.click();

    // Wait for dialog to close
    await expect(reassignDialog).not.toBeVisible();

    // Verify new vendor is assigned
    await expect(assignedService.locator('text="Verification Services LLC"')).toBeVisible();
  });

  test('admin can view service audit history', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    const firstServiceRow = page.locator('tbody tr').first();
    const actionsButton = firstServiceRow.locator('button:has-text("Actions")');
    await actionsButton.click();

    // Click view history option
    const viewHistoryOption = page.locator('button:has-text("View History"), a:has-text("View History")');
    await viewHistoryOption.click();

    // History dialog should open
    const historyDialog = page.locator('dialog:has-text("Service History")');
    await expect(historyDialog).toBeVisible();

    // Should show audit entries
    const auditEntries = historyDialog.locator('.audit-entry, tr.history-row');
    await expect(auditEntries).toHaveCount(3); // Multiple history entries

    // Verify entry details
    const firstEntry = auditEntries.first();
    await expect(firstEntry.locator('text=/status_change|vendor_assignment|note_update/')).toBeVisible();
    await expect(firstEntry.locator('text=/\\d{4}-\\d{2}-\\d{2}/')).toBeVisible(); // Date
    await expect(firstEntry.locator('text=/@.*\\.com/')).toBeVisible(); // User email
  });

  test('admin can close order when all services are complete', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-all-complete');

    // All services should show as completed or cancelled
    const serviceStatuses = page.locator('.service-status, span[aria-label*="status"]');
    const statusTexts = await serviceStatuses.allTextContents();

    statusTexts.forEach(status => {
      expect(['completed', 'cancelled']).toContain(status.toLowerCase());
    });

    // Order closure option should be available
    const closeOrderButton = page.locator('button:has-text("Close Order")');
    await expect(closeOrderButton).toBeVisible();
    await expect(closeOrderButton).toBeEnabled();

    await closeOrderButton.click();

    // Closure dialog should open
    const closureDialog = page.locator('dialog:has-text("Close Order")');
    await expect(closureDialog).toBeVisible();

    // Closure comments should be required
    const commentsField = closureDialog.locator('textarea[name="closureComments"]');
    await expect(commentsField).toBeVisible();
    await expect(commentsField).toHaveAttribute('required', '');

    // Enter closure comments
    await commentsField.fill('All background checks completed successfully. No issues found. Candidate cleared for employment.');

    // Confirm closure
    const confirmButton = closureDialog.locator('button:has-text("Close Order")');
    await confirmButton.click();

    // Wait for dialog to close
    await expect(closureDialog).not.toBeVisible();

    // Order status should update to closed
    await expect(page.locator('span:has-text("closed"), .badge:has-text("closed")')).toBeVisible();

    // Close order button should be disabled
    await expect(closeOrderButton).toBeDisabled();
  });

  test('should prevent closing order when services are incomplete', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-incomplete');

    // Some services should still be in progress
    const pendingServices = page.locator('span:has-text("pending"), span:has-text("processing"), span:has-text("submitted")');
    const pendingCount = await pendingServices.count();
    expect(pendingCount).toBeGreaterThan(0);

    // Close order button should be disabled
    const closeOrderButton = page.locator('button:has-text("Close Order")');
    await expect(closeOrderButton).toBeVisible();
    await expect(closeOrderButton).toBeDisabled();

    // Hover for tooltip explanation
    await closeOrderButton.hover();
    await expect(page.locator('text="Cannot close order - not all services are complete"')).toBeVisible();
  });

  test('should handle deactivated vendor services correctly', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-deactivated-vendor');

    // Service with deactivated vendor should be flagged
    const deactivatedVendorRow = page.locator('tr:has-text("(Deactivated)")');
    await expect(deactivatedVendorRow).toBeVisible();

    // Should still show vendor name with deactivated flag
    await expect(deactivatedVendorRow.locator('text="Old Vendor Co (Deactivated)"')).toBeVisible();

    // Reassignment should be available
    const reassignButton = deactivatedVendorRow.locator('button:has-text("Reassign")');
    await expect(reassignButton).toBeVisible();
    await expect(reassignButton).toBeEnabled();

    // Try to assign new service to deactivated vendor
    const unassignedService = page.locator('tr:has-text("Not Assigned")').first();
    const assignButton = unassignedService.locator('button:has-text("Assign")');
    await assignButton.click();

    const assignDialog = page.locator('dialog:has-text("Assign Service to Vendor")');
    const vendorSelect = assignDialog.locator('select[name="vendorId"]');

    // Deactivated vendor should not be in dropdown options
    const options = await vendorSelect.locator('option').allTextContents();
    expect(options).not.toContain('Old Vendor Co');
  });

  test('vendor can see terminal status services', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    // Login as vendor
    await page.goto('/api/auth/signout');
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'vendor@example.com');
    await page.fill('input[name="password"]', 'vendor-password');
    await page.click('button[type="submit"]');

    await page.goto('/fulfillment/services');

    // Should see completed services
    const completedServices = page.locator('tr:has(span:has-text("completed"))');
    await expect(completedServices).toHaveCount(2);

    // Should see cancelled services
    const cancelledServices = page.locator('tr:has(span:has-text("cancelled"))');
    await expect(cancelledServices).toHaveCount(1);

    // Status dropdowns should be disabled for terminal statuses
    const completedRow = completedServices.first();
    const statusDropdown = completedRow.locator('select[name="status"]');
    await expect(statusDropdown).toBeDisabled();
  });

  test('should filter services by various criteria', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-many-services');

    // Filter by status
    const statusFilter = page.locator('select[aria-label="Filter by Status"]');
    await statusFilter.selectOption('completed');

    // Only completed services should be visible
    const visibleRows = page.locator('tbody tr:visible');
    const visibleCount = await visibleRows.count();

    for (let i = 0; i < visibleCount; i++) {
      const row = visibleRows.nth(i);
      await expect(row.locator('span:has-text("completed")')).toBeVisible();
    }

    // Clear status filter
    await statusFilter.selectOption('');

    // Filter by vendor
    const vendorFilter = page.locator('select[aria-label="Filter by Vendor"]');
    await vendorFilter.selectOption({ label: 'Background Vendor Inc' });

    // Only services assigned to this vendor should be visible
    const vendorRows = page.locator('tbody tr:visible');
    const vendorCount = await vendorRows.count();

    for (let i = 0; i < vendorCount; i++) {
      const row = vendorRows.nth(i);
      await expect(row.locator('text="Background Vendor Inc"')).toBeVisible();
    }

    // Filter unassigned services
    await vendorFilter.selectOption('unassigned');

    // Only unassigned services should be visible
    const unassignedRows = page.locator('tbody tr:visible');
    const unassignedCount = await unassignedRows.count();

    for (let i = 0; i < unassignedCount; i++) {
      const row = unassignedRows.nth(i);
      await expect(row.locator('text="Not Assigned"')).toBeVisible();
    }
  });

  test('should sort services by different columns', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    // Sort by service name
    const serviceHeader = page.locator('th:has-text("Service")');
    await serviceHeader.click();

    // Verify alphabetical order
    const serviceNames = await page.locator('tbody tr td:nth-child(1)').allTextContents();
    const sortedNames = [...serviceNames].sort();
    expect(serviceNames).toEqual(sortedNames);

    // Sort by status
    const statusHeader = page.locator('th:has-text("Status")');
    await statusHeader.click();

    // Verify status order (alphabetical or by enum order)
    const statuses = await page.locator('tbody tr td:nth-child(3)').allTextContents();
    const sortedStatuses = [...statuses].sort();
    expect(statuses).toEqual(sortedStatuses);
  });

  test('should handle concurrent updates gracefully', async ({ authenticatedPage: page, context }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    // Open same order in second tab
    const page2 = await context.newPage();
    await page2.goto('/fulfillment/orders/test-order-with-services');

    // Update service status in first tab
    const statusDropdown1 = page.locator('select[name="status"]').first();
    await statusDropdown1.selectOption('processing');

    // Try to assign vendor in second tab for same service
    const assignButton2 = page2.locator('button:has-text("Assign")').first();
    await assignButton2.click();

    const assignDialog2 = page2.locator('dialog:has-text("Assign Service to Vendor")');
    const vendorSelect2 = assignDialog2.locator('select[name="vendorId"]');
    await vendorSelect2.selectOption({ label: 'Background Vendor Inc' });

    const confirmButton2 = assignDialog2.locator('button:has-text("Confirm Assignment")');
    await confirmButton2.click();

    // Should handle gracefully - either succeed or show appropriate message
    await expect(page2.locator('text=/assigned|updated|conflict/')).toBeVisible({ timeout: 5000 });
  });

  test('should export service fulfillment report', async ({ authenticatedPage: page }) => {
    // THIS TEST WILL FAIL because the feature doesn't exist yet

    await page.goto('/fulfillment/orders/test-order-with-services');

    // Click export button
    const exportButton = page.locator('button:has-text("Export Services")');
    await exportButton.click();

    // Export options dialog
    const exportDialog = page.locator('dialog:has-text("Export Service Fulfillment Data")');
    await expect(exportDialog).toBeVisible();

    // Select export format
    const formatSelect = exportDialog.locator('select[name="format"]');
    await formatSelect.selectOption('csv');

    // Select fields to include
    const includeNotesCheckbox = exportDialog.locator('input[name="includeNotes"]');
    await includeNotesCheckbox.check();

    const includeHistoryCheckbox = exportDialog.locator('input[name="includeHistory"]');
    await includeHistoryCheckbox.check();

    // Download export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportDialog.locator('button:has-text("Export")').click()
    ]);

    // Verify download
    expect(download.suggestedFilename()).toContain('service-fulfillment');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});