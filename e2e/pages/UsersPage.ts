// /GlobalRX_v2/e2e/pages/UsersPage.ts

import { Page } from '@playwright/test';

export class UsersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/users');
    await this.page.waitForLoadState('networkidle');
  }

  async clickAddUser() {
    await this.page.getByRole('button', { name: /add user/i }).click();
  }

  async fillUserForm(user: {
    email: string;
    name: string;
    type: 'internal' | 'customer' | 'vendor';
    customerId?: string;
    vendorId?: string;
    permissions?: string[];
  }) {
    await this.page.getByLabel(/email/i).fill(user.email);
    await this.page.getByLabel(/name/i).fill(user.name);
    await this.page.getByLabel(/user type/i).selectOption(user.type);

    if (user.type === 'customer' && user.customerId) {
      await this.page.getByLabel(/customer/i).selectOption(user.customerId);
    }

    if (user.type === 'vendor' && user.vendorId) {
      await this.page.getByLabel(/vendor organization/i).selectOption(user.vendorId);
    }

    if (user.permissions) {
      for (const permission of user.permissions) {
        await this.page.getByLabel(new RegExp(permission, 'i')).check();
      }
    }
  }

  async saveUser() {
    await this.page.getByRole('button', { name: /save/i }).click();
  }

  async cancelUserForm() {
    await this.page.getByRole('button', { name: /cancel/i }).click();
  }

  async searchUsers(query: string) {
    await this.page.getByPlaceholder(/search users/i).fill(query);
  }

  async filterByType(type: 'all' | 'internal' | 'customer' | 'vendor') {
    await this.page.getByLabel(/filter by type/i).selectOption(type);
  }

  async getUserRow(userEmail: string) {
    return this.page.locator('tr').filter({ hasText: userEmail });
  }

  async editUser(userEmail: string) {
    const row = await this.getUserRow(userEmail);
    await row.getByRole('button', { name: /actions/i }).click();
    await this.page.getByRole('menuitem', { name: /edit/i }).click();
  }

  async deactivateUser(userEmail: string) {
    const row = await this.getUserRow(userEmail);
    await row.getByRole('button', { name: /actions/i }).click();
    await this.page.getByRole('menuitem', { name: /deactivate/i }).click();
  }

  async deleteUser(userEmail: string) {
    const row = await this.getUserRow(userEmail);
    await row.getByRole('button', { name: /actions/i }).click();
    await this.page.getByRole('menuitem', { name: /delete/i }).click();
  }

  async confirmAction() {
    await this.page.getByRole('button', { name: /confirm/i }).click();
  }
}