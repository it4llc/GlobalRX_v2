// /GlobalRX_v2/e2e/pages/VendorsPage.ts

import { Page } from '@playwright/test';

export class VendorsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/vendors');
    await this.page.waitForLoadState('networkidle');
  }

  async clickAddVendor() {
    await this.page.getByRole('button', { name: /add vendor/i }).click();
  }

  async fillVendorForm(vendor: {
    name: string;
    code: string;
    contactEmail: string;
    contactPhone: string;
    address?: string;
    notes?: string;
    isPrimary?: boolean;
    isActive?: boolean;
  }) {
    await this.page.getByLabel(/vendor name/i).fill(vendor.name);
    await this.page.getByLabel(/vendor code/i).fill(vendor.code);
    await this.page.getByLabel(/contact email/i).fill(vendor.contactEmail);
    await this.page.getByLabel(/contact phone/i).fill(vendor.contactPhone);

    if (vendor.address) {
      await this.page.getByLabel(/address/i).fill(vendor.address);
    }

    if (vendor.notes) {
      await this.page.getByLabel(/notes/i).fill(vendor.notes);
    }

    if (vendor.isPrimary) {
      await this.page.getByLabel(/primary vendor/i).check();
    }

    if (vendor.isActive === false) {
      await this.page.getByLabel(/active/i).uncheck();
    }
  }

  async saveVendor() {
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async cancelVendorForm() {
    await this.page.getByRole('button', { name: /cancel/i }).click();
  }

  async searchVendors(query: string) {
    await this.page.getByPlaceholder(/search vendors/i).fill(query);
  }

  async filterByStatus(status: 'active' | 'inactive' | 'all') {
    await this.page.getByLabel(/filter by status/i).selectOption(status);
  }

  async getVendorRow(vendorName: string) {
    return this.page.locator('tr').filter({ hasText: vendorName });
  }

  async editVendor(vendorName: string) {
    const row = await this.getVendorRow(vendorName);
    await row.getByRole('button', { name: /actions/i }).click();
    await this.page.getByRole('menuitem', { name: /edit/i }).click();
  }

  async deleteVendor(vendorName: string) {
    const row = await this.getVendorRow(vendorName);
    await row.getByRole('button', { name: /actions/i }).click();
    await this.page.getByRole('menuitem', { name: /delete/i }).click();
  }

  async confirmDelete() {
    await this.page.getByRole('button', { name: /delete/i }).click();
  }
}