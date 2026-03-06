// /GlobalRX_v2/e2e/pages/CommentTemplatesPage.ts

import { Page, Locator } from '@playwright/test';

export class CommentTemplatesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly grid: Locator;
  readonly addTemplateButtons: Locator;
  readonly templateButtons: Locator;
  readonly createDialog: Locator;
  readonly editDialog: Locator;
  readonly templateTextarea: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly cancelButton: Locator;
  readonly serviceFilter: Locator;
  readonly statusFilter: Locator;
  readonly searchInput: Locator;
  readonly exportButton: Locator;
  readonly importButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /comment templates/i });
    this.grid = page.locator('[data-testid="comment-template-grid"]');
    this.addTemplateButtons = page.getByRole('button', { name: /add template/i });
    this.templateButtons = page.locator('[data-testid^="cell-"]').locator('button:not(:has-text("Add template"))');
    this.createDialog = page.getByRole('dialog', { name: /create template/i });
    this.editDialog = page.getByRole('dialog', { name: /edit template/i });
    this.templateTextarea = page.getByLabel(/template text/i);
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.deleteButton = page.getByRole('button', { name: /delete/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.serviceFilter = page.getByLabel(/filter by service/i);
    this.statusFilter = page.getByLabel(/filter by status/i);
    this.searchInput = page.getByPlaceholder(/search templates/i);
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.importButton = page.getByRole('button', { name: /import/i });
  }

  async goto() {
    await this.page.goto('/comment-templates');
    await this.heading.waitFor({ state: 'visible' });
  }

  async getCell(serviceCode: string, status: string): Promise<Locator> {
    return this.page.locator(`[data-testid="cell-${serviceCode}-${status}"]`);
  }

  async getCellTemplate(serviceCode: string, status: string): Promise<string | null> {
    const cell = await this.getCell(serviceCode, status);
    const button = cell.locator('button:not(:has-text("Add template"))');

    if (await button.count() > 0) {
      return await button.textContent();
    }
    return null;
  }

  async clickAddTemplate(serviceCode: string, status: string) {
    const cell = await this.getCell(serviceCode, status);
    await cell.getByRole('button', { name: /add template/i }).click();
    await this.createDialog.waitFor({ state: 'visible' });
  }

  async clickTemplate(serviceCode: string, status: string) {
    const cell = await this.getCell(serviceCode, status);
    const button = cell.locator('button:not(:has-text("Add template"))');
    await button.click();
    await this.editDialog.waitFor({ state: 'visible' });
  }

  async fillTemplate(text: string) {
    await this.templateTextarea.clear();
    await this.templateTextarea.fill(text);
  }

  async saveTemplate() {
    await this.saveButton.click();
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/comment-templates') &&
      (resp.status() === 200 || resp.status() === 201)
    );
  }

  async deleteTemplate() {
    await this.deleteButton.click();

    // Wait for confirmation dialog
    const confirmDialog = this.page.getByRole('dialog').filter({
      hasText: /are you sure|confirm/i
    });
    await confirmDialog.waitFor({ state: 'visible' });

    // Click confirm
    await confirmDialog.getByRole('button', { name: /confirm|delete|archive/i }).click();

    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/comment-templates') &&
      resp.status() === 200
    );
  }

  async createTemplate(serviceCode: string, status: string, template: string) {
    await this.clickAddTemplate(serviceCode, status);
    await this.fillTemplate(template);
    await this.saveTemplate();

    // Wait for success message
    await this.page.getByText(/template created successfully/i).waitFor({ state: 'visible' });
  }

  async updateTemplate(serviceCode: string, status: string, newTemplate: string) {
    await this.clickTemplate(serviceCode, status);
    await this.fillTemplate(newTemplate);
    await this.saveTemplate();

    // Wait for success message
    await this.page.getByText(/template updated successfully/i).waitFor({ state: 'visible' });
  }

  async deleteTemplateAt(serviceCode: string, status: string) {
    await this.clickTemplate(serviceCode, status);
    await this.deleteTemplate();

    // Wait for success message
    await this.page.getByText(/template (deleted|archived) successfully/i).waitFor({ state: 'visible' });
  }

  async filterByService(serviceCode: string) {
    if (await this.serviceFilter.count() > 0) {
      await this.serviceFilter.selectOption(serviceCode);
      // Wait for grid to update
      await this.page.waitForTimeout(500);
    }
  }

  async filterByStatus(status: string) {
    if (await this.statusFilter.count() > 0) {
      await this.statusFilter.selectOption(status);
      // Wait for grid to update
      await this.page.waitForTimeout(500);
    }
  }

  async searchTemplates(query: string) {
    if (await this.searchInput.count() > 0) {
      await this.searchInput.clear();
      await this.searchInput.fill(query);
      // Wait for search debounce
      await this.page.waitForTimeout(500);
    }
  }

  async exportTemplates() {
    if (await this.exportButton.count() > 0) {
      const downloadPromise = this.page.waitForEvent('download');
      await this.exportButton.click();
      return await downloadPromise;
    }
    return null;
  }

  async importTemplates(filePath: string) {
    if (await this.importButton.count() > 0) {
      await this.importButton.click();

      const importDialog = this.page.getByRole('dialog', { name: /import templates/i });
      await importDialog.waitFor({ state: 'visible' });

      const fileInput = importDialog.getByLabel(/choose file/i);
      await fileInput.setInputFiles(filePath);

      await importDialog.getByRole('button', { name: /import/i }).click();

      // Wait for import to complete
      await this.page.waitForResponse(resp =>
        resp.url().includes('/api/comment-templates/import') &&
        resp.status() === 200
      );

      await this.page.getByText(/import successful/i).waitFor({ state: 'visible' });
    }
  }

  async getTemplateCount(): Promise<number> {
    return await this.templateButtons.count();
  }

  async hasUsedIndicator(serviceCode: string, status: string): Promise<boolean> {
    const cell = await this.getCell(serviceCode, status);
    const indicator = cell.locator('[data-testid="used-indicator"]');
    return await indicator.count() > 0;
  }

  async getCharacterCount(): Promise<string | null> {
    const dialog = this.page.getByRole('dialog');
    const charCount = dialog.locator('text=/\\d+\\/1000/');

    if (await charCount.count() > 0) {
      return await charCount.textContent();
    }
    return null;
  }

  async isServiceFieldDisabled(): Promise<boolean> {
    const dialog = this.page.getByRole('dialog');
    const serviceField = dialog.getByLabel(/service/i);
    return await serviceField.isDisabled();
  }

  async isStatusFieldDisabled(): Promise<boolean> {
    const dialog = this.page.getByRole('dialog');
    const statusField = dialog.getByLabel(/status/i);
    return await statusField.isDisabled();
  }

  async getValidationError(): Promise<string | null> {
    const dialog = this.page.getByRole('dialog');
    const error = dialog.locator('.error-message, [role="alert"]');

    if (await error.count() > 0) {
      return await error.textContent();
    }
    return null;
  }

  async getSuccessMessage(): Promise<string | null> {
    const success = this.page.locator('[role="status"]').filter({ hasText: /success/i });

    if (await success.count() > 0) {
      return await success.textContent();
    }
    return null;
  }

  async getRowHeaders(): Promise<string[]> {
    const headers = this.page.getByRole('rowheader');
    const count = await headers.count();
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text) result.push(text);
    }

    return result;
  }

  async getColumnHeaders(): Promise<string[]> {
    const headers = this.page.getByRole('columnheader');
    const count = await headers.count();
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await headers.nth(i).textContent();
      if (text) result.push(text);
    }

    return result;
  }
}