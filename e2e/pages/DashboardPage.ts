import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly customersLink: Locator;
  readonly ordersLink: Locator;
  readonly settingsLink: Locator;
  readonly welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, button:has-text("Account")');
    this.logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")');
    this.customersLink = page.locator('a[href*="/customers"], nav >> text=Customers');
    this.ordersLink = page.locator('a[href*="/orders"], nav >> text=Orders');
    this.settingsLink = page.locator('a[href*="/settings"], nav >> text=Settings');
    this.welcomeMessage = page.locator('h1, h2').first();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.welcomeMessage.waitFor({ state: 'visible', timeout: 10000 });
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
    await this.page.waitForURL('**/login');
  }

  async navigateToCustomers() {
    await this.customersLink.click();
    await this.page.waitForURL('**/customers');
  }

  async navigateToOrders() {
    await this.ordersLink.click();
    await this.page.waitForURL('**/orders');
  }

  async navigateToSettings() {
    await this.settingsLink.click();
    await this.page.waitForURL('**/settings');
  }
}